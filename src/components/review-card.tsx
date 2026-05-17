import { Review } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface ReviewCardProps {
  review: Review;
}

const STAR_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-600",
  5: "text-green-600",
};

function renderStars(rating: number) {
  return (
    <span className={`font-semibold ${STAR_COLORS[rating] ?? "text-gray-500"}`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {renderStars(review.rating)}
          <Badge variant="secondary" className="text-[10px]">
            {review.appName}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {review.author} · {formatDate(review.date)}
        </span>
      </div>
      {review.title && <p className="font-medium text-sm">{review.title}</p>}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {review.text}
      </p>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        {review.appVersion && <span>v{review.appVersion}</span>}
        {review.helpfulCount > 0 && <span>{review.helpfulCount} helpful</span>}
      </div>
    </div>
  );
}
