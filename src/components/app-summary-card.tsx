import { AppScrapeResult } from "@/lib/types";

interface AppSummaryCardProps {
  result: AppScrapeResult;
  isSelected: boolean;
  onClick: () => void;
}

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-400",
  2: "bg-orange-400",
  3: "bg-yellow-400",
  4: "bg-lime-400",
  5: "bg-emerald-400",
};

const RATING_GLOWS: Record<number, string> = {
  1: "shadow-red-500/30",
  2: "shadow-orange-500/30",
  3: "shadow-yellow-500/30",
  4: "shadow-lime-500/30",
  5: "shadow-emerald-500/30",
};

export function AppSummaryCard({ result, isSelected, onClick }: AppSummaryCardProps) {
  const { appInfo, reviews } = result;

  const distribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: reviews.filter((rev) => rev.rating === r).length,
  }));
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  // Find the dominant rating for glow effect
  const dominant = distribution.reduce((a, b) => (a.count >= b.count ? a : b), distribution[0]);

  return (
    <div
      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
        isSelected
          ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
          : "bg-card/50 border-transparent hover:bg-card hover:border-border"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {appInfo.icon && (
          <img
            src={appInfo.icon}
            alt={appInfo.name}
            className="w-10 h-10 rounded-xl shrink-0 ring-1 ring-white/10"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{appInfo.name}</p>
          <p className="text-[11px] text-muted-foreground">{reviews.length} reviews</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {distribution.map((d) => (
          <div key={d.rating} className="flex items-center gap-1.5">
            <span className="text-[10px] w-2 text-right text-muted-foreground/60">{d.rating}</span>
            <div className="flex-1 h-1 bg-muted/50 rounded-full overflow-hidden">
              {d.count > 0 && (
                <div
                  className={`h-full rounded-full ${RATING_COLORS[d.rating]} ${
                    d === dominant && d.count > 0 ? `shadow-sm ${RATING_GLOWS[d.rating]}` : ""
                  }`}
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              )}
            </div>
            <span className="text-[10px] w-4 text-muted-foreground/60 tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
