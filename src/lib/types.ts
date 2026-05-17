export interface Review {
  appId: string;
  appName: string;
  reviewId: string;
  rating: number;
  title: string;
  text: string;
  author: string;
  date: string;
  helpfulCount: number;
  appVersion: string;
}

export interface AppInfo {
  appId: string;
  name: string;
  icon: string;
  ratingCount: number;
  averageRating: number;
}

export interface AppScrapeResult {
  appInfo: AppInfo;
  reviews: Review[];
}

export type ScrapeEvent =
  | { type: "app"; data: AppScrapeResult }
  | { type: "error"; appId: string; error: string }
  | { type: "done"; totalApps: number; totalReviews: number };

export const RATING_OPTIONS = [
  { label: "1 or 2 stars", value: "1,2" },
  { label: "3 stars", value: "3" },
  { label: "4 stars", value: "4" },
  { label: "5 stars", value: "5" },
] as const;
