import { AcquisitionApp, SortOption } from "./types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const RSS_TOP_FREE = "https://itunes.apple.com/rss/topfreeapplications/limit=200/genre=";
const RSS_TOP_PAID = "https://itunes.apple.com/rss/toppaidapplications/limit=200/genre=";

// Well-known brands to exclude — we want small devs only
const BLOCKED_SELLERS = new Set([
  "google llc", "apple inc.", "microsoft corporation", "meta platforms, inc.",
  "amazon.com", "amazon mobile llc", "spotify ab", "spotify", "netflix, inc.",
  "snap, inc.", "twitter, inc.", "x corp.", "whatsapp inc.", "meta",
  "adobe inc.", "zoom video communications, inc.", "dropbox, inc.",
  "uber technologies, inc.", "lyft, inc.", "airbnb, inc.",
  "samsung electronics co., ltd.", "huawei device co., ltd.",
  "linkedin corporation", "pinterest", "tiktok ltd.", "bytedance ltd.",
  "discord, inc.", "telegram messenger inc.", "signal foundation",
  "openai, llc", "openai", "anthropic", "square, inc.", "block, inc.",
  "paypal, inc.", "venmo", "coinbase, inc.", "robinhood",
  "intel corporation", "nvidia corporation", "cisco systems, inc.",
  "oracle corporation", "ibm corporation", "salesforce, inc.",
  "atlassian", "slack technologies, inc.", "shopify inc.",
  "walmart", "target corporation", "the home depot",
  "disney electronic content, inc.", "warnermedia", "paramount global",
  "comcast", "verizon", "at&t services, inc.", "t-mobile",
  "peloton interactive, inc.", "strava, inc.", "yelp, inc.",
  "ziprecruiter, inc.", "indeed", "match group, llc",
  "ea swiss sarl", "electronic arts", "activision publishing, inc.",
  "king.com limited", "supercell oy", "niantic, inc.",
  "nintendo co., ltd.", "sega", "bandai namco",
  "tiktok pte. ltd.", "musical.ly inc.",
  "shein", "temu", "alibaba",
  "alipay", "wechat", "tencent",
  "skype communications s.a.r.l", "viber media s.à r.l.",
]);

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

function toAcquisitionApp(r: ITunesResult): AcquisitionApp | null {
  const seller = (r.sellerName ?? r.artistName ?? "").toLowerCase();
  // Skip big brands
  if (BLOCKED_SELLERS.has(seller)) return null;
  // Skip if seller name contains a well-known brand substring
  for (const brand of ["google", "apple", "microsoft", "meta platform", "spotify", "netflix", "openai", "tiktok", "bytedance", "tencent", "alibaba"]) {
    if (seller.includes(brand)) return null;
  }

  const lastUpdated = r.currentVersionReleaseDate ?? r.releaseDate ?? "";
  const daysSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;

  // Skip apps updated within the last 3 months
  if (daysSinceUpdate < 90) return null;

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

function applySort(apps: AcquisitionApp[], sort: SortOption): AcquisitionApp[] {
  switch (sort) {
    case "most_ratings":
      return apps.sort((a, b) => b.ratingCount - a.ratingCount);
    case "highest_rated":
      return apps.sort((a, b) => b.averageRating - a.averageRating || b.ratingCount - a.ratingCount);
    case "longest_neglected":
      return apps.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    default:
      return apps;
  }
}

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
        const app = toAcquisitionApp(r);
        if (app) apps.push(app);
      }
    } catch {
      continue;
    }
  }

  return apps;
}

export async function discoverByCategory(
  genreIds: number[],
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

  return applySort(Array.from(allApps.values()), sort);
}

export async function discoverApps(
  keywords: string[],
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
        const app = toAcquisitionApp(r);
        if (app && !allApps.has(app.appId)) {
          allApps.set(app.appId, app);
        }
      }
    } catch {
      continue;
    }
  }

  return applySort(Array.from(allApps.values()), sort);
}
