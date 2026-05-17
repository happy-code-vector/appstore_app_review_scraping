import { Review } from "@/lib/types";
import { ReviewCard } from "./review-card";

interface ReviewFeedProps {
  reviews: Review[];
  totalScraped: number;
}

export function ReviewFeed({ reviews, totalScraped }: ReviewFeedProps) {
  if (reviews.length === 0 && totalScraped === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Enter app IDs and click Scrape to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-background z-10">
        <p className="text-sm text-muted-foreground">
          Showing {reviews.length} review{reviews.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="p-4 space-y-3">
        {reviews.map((review, i) => (
          <ReviewCard key={`${review.appId}-${review.reviewId}-${i}`} review={review} />
        ))}
        {reviews.length === 0 && totalScraped > 0 && (
          <p className="text-center text-muted-foreground py-8">
            No reviews match the selected filter
          </p>
        )}
      </div>
    </div>
  );
}
