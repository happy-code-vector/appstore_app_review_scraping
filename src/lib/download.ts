import { Review } from "./types";

export function downloadAsCSV(reviews: Review[], filename: string) {
  const headers = ["app_id", "app_name", "rating", "title", "text", "author", "date", "helpful_count", "app_version", "review_id"];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = reviews.map((r) =>
    [r.appId, escape(r.appName), r.rating, escape(r.title), escape(r.text), escape(r.author), r.date, r.helpfulCount, escape(r.appVersion), escape(r.reviewId)].join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename, "text/csv");
}

export function downloadAsJSON(reviews: Review[], filename: string) {
  const grouped: Record<string, { app_id: string; app_name: string; reviews: Omit<Review, "appId" | "appName">[] }> = {};

  for (const r of reviews) {
    if (!grouped[r.appId]) {
      grouped[r.appId] = { app_id: r.appId, app_name: r.appName, reviews: [] };
    }
    grouped[r.appId].reviews.push({
      rating: r.rating,
      title: r.title,
      text: r.text,
      author: r.author,
      date: r.date,
      helpfulCount: r.helpfulCount,
      appVersion: r.appVersion,
      reviewId: r.reviewId,
    });
  }

  const json = JSON.stringify(Object.values(grouped), null, 2);
  downloadBlob(json, filename, "application/json");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
