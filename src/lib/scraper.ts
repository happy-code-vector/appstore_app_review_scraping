import { AppInfo, AppScrapeResult, Review } from "./types";

const ITUNES_LOOKUP = "https://itunes.apple.com/lookup?id=";
const RSS_REVIEWS = "https://itunes.apple.com/rss/customerreviews/id=";

interface RssEntry {
  "im:name"?: { label: string };
  "im:rating"?: { label: string };
  "im:voteCount"?: { label: string };
  "im:version"?: { label: string };
  title?: { label: string };
  content?: { label: string };
  author?: { name?: { label: string } };
  id?: { label: string };
  updated?: { label: string };
}

export async function fetchAppInfo(appId: string): Promise<AppInfo | null> {
  try {
    const res = await fetch(`${ITUNES_LOOKUP}${appId}`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.resultCount === 0) return null;
    const r = data.results[0];
    return {
      appId,
      name: r.trackName ?? "Unknown",
      icon: r.artworkUrl60 ?? r.artworkUrl100 ?? "",
      ratingCount: r.userRatingCount ?? 0,
      averageRating: r.averageUserRating ?? 0,
    };
  } catch {
    return null;
  }
}

function parseEntries(entries: RssEntry[], appId: string, appName: string, ratings: number[], maxReviews: number, reviews: Review[]) {
  for (const entry of entries) {
    if (reviews.length >= maxReviews) break;
    if (entry["im:name"]) continue;

    const rating = parseInt(entry["im:rating"]?.label ?? "0", 10);
    if (isNaN(rating) || !ratings.includes(rating)) continue;

    reviews.push({
      appId,
      appName,
      reviewId: entry.id?.label ?? "",
      rating,
      title: (entry.title?.label ?? "").slice(0, 200),
      text: (entry.content?.label ?? "").slice(0, 5000),
      author: entry.author?.name?.label ?? "",
      date: entry.updated?.label ?? new Date().toISOString(),
      helpfulCount: parseInt(entry["im:voteCount"]?.label ?? "0", 10),
      appVersion: entry["im:version"]?.label ?? "",
    });
  }
}

export async function fetchReviews(
  appId: string,
  ratings: number[],
  maxReviews: number
): Promise<AppScrapeResult | null> {
  const appInfo = await fetchAppInfo(appId);
  if (!appInfo) return null;

  const reviews: Review[] = [];
  let page = 1;
  const maxPages = 10;

  while (reviews.length < maxReviews && page <= maxPages) {
    try {
      const url = `${RSS_REVIEWS}${appId}/sortBy=mostRecent/page=${page}/json`;
      const res = await fetch(url, { next: { revalidate: 0 } });

      if (!res.ok) break;

      const data = await res.json();
      const entries: RssEntry[] = data?.feed?.entry ?? [];

      if (entries.length === 0) break;

      const before = reviews.length;
      parseEntries(entries, appId, appInfo.name, ratings, maxReviews, reviews);

      // If no new reviews were added from this page, or fewer raw entries than expected, stop
      if (reviews.length === before || entries.length < 2) break;

      page++;
    } catch {
      break;
    }
  }

  return { appInfo, reviews };
}
