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

// --- Discover modes, sort options & categories ---

export type SortOption = "most_ratings" | "highest_rated" | "longest_neglected";

export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Most Ratings", value: "most_ratings" },
  { label: "Highest Rated", value: "highest_rated" },
  { label: "Longest Neglected", value: "longest_neglected" },
];

export interface AppStoreCategory {
  id: number;
  name: string;
}

export const APP_STORE_CATEGORIES: AppStoreCategory[] = [
  { id: 6000, name: "Business" },
  { id: 6014, name: "Education" },
  { id: 6015, name: "Entertainment" },
  { id: 6016, name: "Finance" },
  { id: 6020, name: "Graphics & Design" },
  { id: 6022, name: "Health & Fitness" },
  { id: 6002, name: "Lifestyle" },
  { id: 6024, name: "Medical" },
  { id: 6017, name: "Music" },
  { id: 6018, name: "News" },
  { id: 6023, name: "Photo & Video" },
  { id: 6004, name: "Productivity" },
  { id: 6025, name: "Reference" },
  { id: 6006, name: "Social Networking" },
  { id: 6026, name: "Sports" },
  { id: 6027, name: "Stickers" },
  { id: 6007, name: "Travel" },
  { id: 6012, name: "Utilities" },
  { id: 6013, name: "Weather" },
  { id: 6021, name: "Developer Tools" },
  { id: 7003, name: "Food & Drink" },
  { id: 7013, name: "Shopping" },
  { id: 7008, name: "Kids" },
  { id: 7017, name: "Magazines & Newspapers" },
  { id: 7012, name: "Navigation" },
];
