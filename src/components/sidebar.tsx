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
    <aside className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm">Apps</h2>
        <p className="text-xs text-muted-foreground">
          {progress.done} / {progress.total} scraped
        </p>
      </div>
      <div className="p-2">
        <button
          className={`w-full text-left text-xs px-3 py-1.5 rounded-md mb-1 ${
            !selectedAppId ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent"
          }`}
          onClick={() => onSelectApp(null)}
        >
          All reviews
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
