interface TabNavProps {
  activeTab: "reviews" | "acquire";
  onChange: (tab: "reviews" | "acquire") => void;
}

const TABS = [
  {
    id: "reviews" as const,
    label: "Review Scraper",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    id: "acquire" as const,
    label: "App Acquisition",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <div className="flex items-center gap-1 px-6 pt-2 bg-card/60 backdrop-blur-sm border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === tab.id
              ? "bg-background text-foreground border border-border border-b-background -mb-px relative z-10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
