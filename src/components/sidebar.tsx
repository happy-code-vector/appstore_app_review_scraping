import { AppScrapeResult } from "@/lib/types";
import { AppSummaryCard } from "./app-summary-card";

interface SidebarProps {
  apps: AppScrapeResult[];
  selectedAppId: string | null;
  onSelectApp: (appId: string | null) => void;
  progress: { done: number; total: number };
}

export function Sidebar({ apps, selectedAppId, onSelectApp, progress }: SidebarProps) {
  return (
    <aside className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Apps</h2>
          {progress.total > 0 && (
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {progress.done} / {progress.total}
            </span>
          )}
        </div>
        {progress.total > 0 && (
          <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="px-3 pt-2">
        <button
          className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
            !selectedAppId
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() => onSelectApp(null)}
        >
          All reviews
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {apps.map((app) => (
          <AppSummaryCard
            key={app.appInfo.appId}
            result={app}
            isSelected={selectedAppId === app.appInfo.appId}
            onClick={() =>
              onSelectApp(selectedAppId === app.appInfo.appId ? null : app.appInfo.appId)
            }
          />
        ))}
      </div>
    </aside>
  );
}
