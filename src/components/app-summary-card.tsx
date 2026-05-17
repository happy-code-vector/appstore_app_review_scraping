import { AppScrapeResult } from "@/lib/types";
import { Card } from "@/components/ui/card";

interface AppSummaryCardProps {
  result: AppScrapeResult;
  isSelected: boolean;
  onClick: () => void;
}

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-lime-500",
  5: "bg-green-500",
};

export function AppSummaryCard({ result, isSelected, onClick }: AppSummaryCardProps) {
  const { appInfo, reviews } = result;

  const distribution = [1, 2, 3, 4, 5].map((r) => ({
    rating: r,
    count: reviews.filter((rev) => rev.rating === r).length,
  }));
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <Card
      className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
        isSelected ? "ring-2 ring-primary bg-accent" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {appInfo.icon && (
          <img
            src={appInfo.icon}
            alt={appInfo.name}
            className="w-10 h-10 rounded-lg shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{appInfo.name}</p>
          <p className="text-xs text-muted-foreground">{reviews.length} reviews</p>
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        {distribution.map((d) => (
          <div key={d.rating} className="flex items-center gap-1">
            <span className="text-[10px] w-3 text-right text-muted-foreground">{d.rating}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${RATING_COLORS[d.rating]}`}
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-[10px] w-5 text-muted-foreground">{d.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
