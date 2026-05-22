import { AcquisitionApp, SortOption, AppStoreCategory, APP_STORE_CATEGORIES } from "./types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";

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

const BLOCKED_BRAND_SUBSTRINGS = [
  "google", "apple", "microsoft", "meta platform", "spotify", "netflix",
  "openai", "tiktok", "bytedance", "tencent", "alibaba",
];

// Search terms per category to get broad, relevant results from iTunes Search
const CATEGORY_SEARCH_TERMS: Record<number, string[]> = {
  6002: ["utilities", "flashlight", "calculator", "scanner", "converter"],
  6001: ["weather", "forecast", "radar", "temperature"],
  6003: ["travel", "hotel", "flight", "booking"],
  6004: ["sports", "scores", "training", "coaching"],
  6005: ["social network", "chat", "messaging", "community"],
  6006: ["dictionary", "translate", "reference", "encyclopedia"],
  6007: ["productivity", "notes", "calendar", "reminder", "planner"],
  6008: ["photo editor", "video editor", "collage", "camera"],
  6009: ["news", "breaking news", "magazine", "newspaper"],
  6010: ["navigation", "gps", "maps", "transit"],
  6011: ["music", "guitar", "piano", "drums", "recording"],
  6013: ["fitness", "workout", "health", "exercise", "calories"],
  6015: ["finance", "budget", "banking", "investing"],
  6016: ["entertainment", "streaming", "videos"],
  6017: ["education", "learning", "study", "school"],
  6000: ["business", "invoice", "crm", "accounting"],
  6020: ["medical", "health record", "doctor", "patient", "pharmacy"],
  6023: ["food", "recipe", "cooking", "restaurant", "delivery"],
  6024: ["shopping", "deals", "coupons", "store"],
  6026: ["developer", "coding", "programming", "ssh", "terminal"],
  6021: ["design", "drawing", "illustration", "graphic"],
  7008: ["kids", "children", "toddler", "preschool"],
};

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

function isBlockedBrand(seller: string): boolean {
  const lower = seller.toLowerCase();
  if (BLOCKED_SELLERS.has(lower)) return true;
  return BLOCKED_BRAND_SUBSTRINGS.some((b) => lower.includes(b));
}

function toAcquisitionApp(r: ITunesResult, genreId?: number): AcquisitionApp | null {
  const seller = r.sellerName ?? r.artistName ?? "";
  if (isBlockedBrand(seller)) return null;

  // If browsing by category, only keep apps in that category
  if (genreId && r.primaryGenreId && r.primaryGenreId !== genreId) return null;

  const lastUpdated = r.currentVersionReleaseDate ?? r.releaseDate ?? "";
  const daysSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;

  if (daysSinceUpdate < 90) return null;

  const price = r.price ?? 0;

  return {
    appId: String(r.trackId),
    name: r.trackName ?? "Unknown",
    icon: r.artworkUrl100 ?? r.artworkUrl60 ?? "",
    developer: seller,
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

export async function discoverByCategory(
  genreIds: number[],
  sort: SortOption
): Promise<AcquisitionApp[]> {
  const allApps = new Map<string, AcquisitionApp>();

  for (const genreId of genreIds) {
    const terms = CATEGORY_SEARCH_TERMS[genreId];
    if (!terms) continue;

    for (const term of terms) {
      try {
        const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=software&country=us&limit=200&genreId=${genreId}`;
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) continue;

        const data = await res.json();
        const results: ITunesResult[] = data.results ?? [];

        for (const r of results) {
          const app = toAcquisitionApp(r, genreId);
          if (app && !allApps.has(app.appId)) {
            allApps.set(app.appId, app);
          }
        }
      } catch {
        continue;
      }
    }
  }

  return applySort(Array.from(allApps.values()), sort);
}

// Fetch results for a single category (used for per-category caching)
export async function discoverSingleCategory(
  genreId: number,
  sort: SortOption
): Promise<AcquisitionApp[]> {
  const terms = CATEGORY_SEARCH_TERMS[genreId];
  if (!terms) return [];

  const allApps = new Map<string, AcquisitionApp>();

  for (const term of terms) {
    try {
      const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=software&country=us&limit=200&genreId=${genreId}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) continue;

      const data = await res.json();
      const results: ITunesResult[] = data.results ?? [];

      for (const r of results) {
        const app = toAcquisitionApp(r, genreId);
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

// Fetch results for a single keyword (used for per-keyword caching)
export async function discoverSingleKeyword(
  keyword: string,
  sort: SortOption
): Promise<AcquisitionApp[]> {
  const allApps = new Map<string, AcquisitionApp>();

  try {
    const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(keyword)}&entity=software&country=us&limit=200`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const data = await res.json();
    const results: ITunesResult[] = data.results ?? [];

    for (const r of results) {
      const app = toAcquisitionApp(r);
      if (app && !allApps.has(app.appId)) {
        allApps.set(app.appId, app);
      }
    }
  } catch {
    // continue
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
