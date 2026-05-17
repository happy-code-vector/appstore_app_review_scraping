import { Review } from "@/lib/types";

interface ReviewCardProps {
  review: Review;
}

const STAR_COLORS: Record<number, string> = {
  1: "text-red-400",
  2: "text-orange-400",
  3: "text-yellow-400",
  4: "text-lime-400",
  5: "text-emerald-400",
};

const STAR_BG: Record<number, string> = {
  1: "bg-red-500/10",
  2: "bg-orange-500/10",
  3: "bg-yellow-500/10",
  4: "bg-lime-500/10",
  5: "bg-emerald-500/10",
};

function renderStars(rating: number) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold ${STAR_COLORS[rating]} ${STAR_BG[rating]}`}>
      {"★".repeat(rating)}
      <span className="opacity-30">{"★".repeat(5 - rating)}</span>
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3 transition-colors hover:bg-card/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {renderStars(review.rating)}
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium truncate max-w-[200px]">
            {review.appName}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
          {formatDate(review.date)}
        </span>
      </div>

      {review.title && <p className="font-semibold text-sm">{review.title}</p>}

      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {review.text}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
            {getInitials(review.author)}
          </div>
          <span className="text-[11px] text-muted-foreground">{review.author}</span>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground/60">
          {review.appVersion && <span>v{review.appVersion}</span>}
          {review.helpfulCount > 0 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/>
              </svg>
              {review.helpfulCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
