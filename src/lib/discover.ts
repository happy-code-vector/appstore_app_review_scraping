import { AcquisitionApp, DiscoverFilters, DiscoverMode, SortOption } from "./types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const RSS_TOP_FREE = "https://itunes.apple.com/rss/topfreeapplications/limit=200/genre=";
const RSS_TOP_PAID = "https://itunes.apple.com/rss/toppaidapplications/limit=200/genre=";

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  sellerName: string;
  sellerUrl?: string;
  trackViewUrl: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  price?: number;
  formattedPrice?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  currentVersionReleaseDate?: string;
  releaseDate?: string;
  description?: string;
  bundleId?: string;
  primaryGenreName?: string;
  primaryGenreId?: number;
}

function toAcquisitionApp(r: ITunesResult): AcquisitionApp {
  const lastUpdated = r.currentVersionReleaseDate ?? r.releaseDate ?? "";
  const daysSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;
  const price = r.price ?? 0;

  return {
    appId: String(r.trackId),
    name: r.trackName ?? "Unknown",
    icon: r.artworkUrl100 ?? r.artworkUrl60 ?? "",
    developer: r.sellerName ?? r.artistName ?? "",
    sellerUrl: r.sellerUrl ?? "",
    category: r.primaryGenreName ?? "",
    price,
    formattedPrice: r.formattedPrice ?? (price === 0 ? "Free" : `$${price}`),
    averageRating: r.averageUserRating ?? 0,
    ratingCount: r.userRatingCount ?? 0,
    lastUpdated,
    daysSinceUpdate,
    trackViewUrl: r.trackViewUrl ?? "",
    description: (r.description ?? "").slice(0, 2000),
    bundleId: r.bundleId ?? "",
    outreachStatus: "not_contacted",
  };
}

function applyModeFilter(apps: AcquisitionApp[], mode: DiscoverMode): AcquisitionApp[] {
  switch (mode) {
    case "abandoned":
      return apps.filter((a) => a.daysSinceUpdate >= 180);
    case "recently_abandoned":
      // Stopped updating 3-6 months ago — was active, now neglected
      return apps.filter((a) => a.daysSinceUpdate >= 90 && a.daysSinceUpdate <= 180);
    default:
      return apps;
  }
}

function applySort(apps: AcquisitionApp[], sort: SortOption): AcquisitionApp[] {
  switch (sort) {
    case "most_ratings":
      return apps.sort((a, b) => b.ratingCount - a.ratingCount);
    case "highest_rated":
      return apps.sort((a, b) => b.averageRating - a.averageRating || b.ratingCount - a.ratingCount);
    case "longest_abandoned":
      return apps.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    default:
      return apps;
  }
}

// Fetch app IDs from RSS top charts for a category
async function fetchTopChartIds(genreId: number): Promise<string[]> {
  const ids = new Set<string>();

  for (const url of [`${RSS_TOP_FREE}${genreId}/json`, `${RSS_TOP_PAID}${genreId}/json`]) {
    try {
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;
      const data = await res.json();
      const entries = data?.feed?.entry ?? [];
      for (const entry of entries) {
        const id = entry?.id?.attributes?.["im:id"];
        if (id) ids.add(id);
      }
    } catch {
      continue;
    }
  }

  return Array.from(ids);
}

// Lookup multiple apps by IDs (batch of up to 100)
async function lookupApps(ids: string[]): Promise<AcquisitionApp[]> {
  if (ids.length === 0) return [];

  const apps: AcquisitionApp[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const res = await fetch(`${ITUNES_LOOKUP}?id=${batch.join(",")}`, {
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results: ITunesResult[] = data.results ?? [];
      for (const r of results) {
        apps.push(toAcquisitionApp(r));
      }
    } catch {
      continue;
    }
  }

  return apps;
}

// Discover by browsing categories via RSS top charts
export async function discoverByCategory(
  genreIds: number[],
  mode: DiscoverMode,
  sort: SortOption
): Promise<AcquisitionApp[]> {
  const allApps = new Map<string, AcquisitionApp>();

  for (const genreId of genreIds) {
    const ids = await fetchTopChartIds(genreId);
    const apps = await lookupApps(ids);

    for (const app of apps) {
      if (!allApps.has(app.appId)) {
        allApps.set(app.appId, app);
      }
    }
  }

  let result = Array.from(allApps.values());
  result = applyModeFilter(result, mode);
  result = applySort(result, sort);

  return result;
}

// Discover by keyword search
export async function discoverApps(
  keywords: string[],
  mode: DiscoverMode,
  sort: SortOption
): Promise<AcquisitionApp[]> {
  const allApps = new Map<string, AcquisitionApp>();

  for (const keyword of keywords) {
    try {
      const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(keyword)}&entity=software&country=us&limit=200`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;

      const data = await res.json();
      const results: ITunesResult[] = data.results ?? [];

      for (const r of results) {
        const appId = String(r.trackId);
        if (allApps.has(appId)) continue;
        allApps.set(appId, toAcquisitionApp(r));
      }
    } catch {
      continue;
    }
  }

  let result = Array.from(allApps.values());
  result = applyModeFilter(result, mode);
  result = applySort(result, sort);

  return result;
}
