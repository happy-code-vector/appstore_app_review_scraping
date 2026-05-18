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

// --- Acquisition types ---

export type OutreachStatus =
  | "not_contacted"
  | "contacted"
  | "responded"
  | "negotiating"
  | "acquired"
  | "declined";

export interface AcquisitionApp {
  appId: string;
  name: string;
  icon: string;
  developer: string;
  sellerUrl: string;
  category: string;
  price: number;
  formattedPrice: string;
  averageRating: number;
  ratingCount: number;
  lastUpdated: string;
  daysSinceUpdate: number;
  trackViewUrl: string;
  description: string;
  bundleId: string;
  outreachStatus: OutreachStatus;
  outreachDate?: string;
  notes?: string;
  savedAt?: string;
}

export interface DiscoverFilters {
  minRatingCount: number;
  minDaysSinceUpdate: number;
  maxPrice: number;
  minAverageRating: number;
}

export const DEFAULT_FILTERS: DiscoverFilters = {
  minRatingCount: 500,
  minDaysSinceUpdate: 540,
  maxPrice: 4.99,
  minAverageRating: 3.0,
};

export const OUTREACH_STATUSES: {
  label: string;
  value: OutreachStatus;
  color: string;
}[] = [
  { label: "New", value: "not_contacted", color: "bg-zinc-400" },
  { label: "Contacted", value: "contacted", color: "bg-blue-400" },
  { label: "Responded", value: "responded", color: "bg-yellow-400" },
  { label: "Negotiating", value: "negotiating", color: "bg-purple-400" },
  { label: "Acquired", value: "acquired", color: "bg-emerald-400" },
  { label: "Declined", value: "declined", color: "bg-red-400" },
];

export const SUGGESTED_KEYWORDS = [
  "calculator",
  "weather",
  "flashlight",
  "qr scanner",
  "pdf reader",
  "unit converter",
  "password manager",
  "workout tracker",
  "calorie counter",
  "sleep tracker",
  "todo list",
  "habit tracker",
  "photo editor",
  "collage maker",
  "white noise",
  "meditation timer",
  "plant care",
  "baby tracker",
  "tip calculator",
  "pomodoro timer",
] as const;
