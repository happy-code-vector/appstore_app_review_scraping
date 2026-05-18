import { AcquisitionApp, DiscoverFilters } from "./types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";

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
  description?: string;
  bundleId?: string;
  primaryGenreName?: string;
}

export async function discoverApps(
  keywords: string[],
  filters: DiscoverFilters
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

        const lastUpdated = r.currentVersionReleaseDate ?? "";
        const daysSinceUpdate = lastUpdated
          ? Math.floor(
              (Date.now() - new Date(lastUpdated).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 9999;

        const ratingCount = r.userRatingCount ?? 0;
        const avgRating = r.averageUserRating ?? 0;
        const price = r.price ?? 0;

        if (ratingCount < filters.minRatingCount) continue;
        if (daysSinceUpdate < filters.minDaysSinceUpdate) continue;
        if (price > filters.maxPrice) continue;
        if (avgRating < filters.minAverageRating) continue;

        allApps.set(appId, {
          appId,
          name: r.trackName ?? "Unknown",
          icon: r.artworkUrl100 ?? r.artworkUrl60 ?? "",
          developer: r.sellerName ?? r.artistName ?? "",
          sellerUrl: r.sellerUrl ?? "",
          category: r.primaryGenreName ?? "",
          price,
          formattedPrice:
            r.formattedPrice ?? (price === 0 ? "Free" : `$${price}`),
          averageRating: avgRating,
          ratingCount,
          lastUpdated,
          daysSinceUpdate,
          trackViewUrl: r.trackViewUrl ?? "",
          description: (r.description ?? "").slice(0, 2000),
          bundleId: r.bundleId ?? "",
          outreachStatus: "not_contacted",
        });
      }
    } catch {
      continue;
    }
  }

  return Array.from(allApps.values()).sort(
    (a, b) => b.ratingCount - a.ratingCount
  );
}
