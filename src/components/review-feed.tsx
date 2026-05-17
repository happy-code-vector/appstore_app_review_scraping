import { Review } from "@/lib/types";
import { ReviewCard } from "./review-card";

interface ReviewFeedProps {
  reviews: Review[];
  totalScraped: number;
}

export function ReviewFeed({ reviews, totalScraped }: ReviewFeedProps) {
  if (reviews.length === 0 && totalScraped === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">No reviews yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Enter app IDs and click Scrape to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <p className="text-xs text-muted-foreground">
          Showing <span className="text-foreground font-medium">{reviews.length}</span> review{reviews.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="p-6 space-y-3">
        {reviews.map((review, i) => (
          <ReviewCard key={`${review.appId}-${review.reviewId}-${i}`} review={review} />
        ))}
        {reviews.length === 0 && totalScraped > 0 && (
          <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>
            <p className="text-sm">No reviews match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
