"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AcquisitionApp,
  DiscoverMode,
  SortOption,
  OutreachStatus,
  OUTREACH_STATUSES,
  SUGGESTED_KEYWORDS,
  DISCOVER_MODES,
  SORT_OPTIONS,
  APP_STORE_CATEGORIES,
} from "@/lib/types";
import { OutreachTemplate, getTemplates, getFullEmail } from "@/lib/outreach-templates";
import { downloadAcquisitionCSV, downloadAcquisitionJSON } from "@/lib/download";

const STORAGE_KEY = "acquisition-pipeline";

function loadPipeline(): AcquisitionApp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(apps: AcquisitionApp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr || "N/A";
  }
}

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: OutreachStatus }) {
  const cfg = OUTREACH_STATUSES.find((s) => s.value === status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg?.color ?? "bg-zinc-400"} bg-opacity-20`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.color ?? "bg-zinc-400"}`} />
      {cfg?.label ?? status}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function AcquireTab() {
  const [keywords, setKeywords] = useState("");
  const [mode, setMode] = useState<DiscoverMode>("abandoned");
  const [sort, setSort] = useState<SortOption>("most_ratings");
  const [searchType, setSearchType] = useState<"categories" | "keywords">("categories");
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AcquisitionApp[]>([]);
  const [pipeline, setPipeline] = useState<AcquisitionApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<AcquisitionApp | null>(null);
  const [view, setView] = useState<"search" | "detail">("search");
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("email-1");
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | "all">("all");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setPipeline(loadPipeline());
  }, []);

  useEffect(() => {
    if (selectedApp) setNotes(selectedApp.notes ?? "");
  }, [selectedApp]);

  // ─── Actions ─────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setError(null);
    setSearching(true);
    setResults([]);
    setSelectedApp(null);
    setView("search");

    const body: Record<string, unknown> = { mode, sort };

    if (searchType === "keywords") {
      const kws = keywords
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      if (!kws.length) {
        setError("Enter at least one keyword.");
        setSearching(false);
        return;
      }
      body.keywords = kws;
    } else {
      const catIds = Array.from(selectedCategories);
      if (!catIds.length) {
        setError("Select at least one category.");
        setSearching(false);
        return;
      }
      body.categoryIds = catIds;
    }

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`Search failed: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      setResults(data.apps ?? []);
      if (!data.apps?.length) {
        setError("No apps found matching your criteria. Try broader filters.");
      }
    } catch (e) {
      setError(`Search error: ${(e as Error).message}`);
    } finally {
      setSearching(false);
    }
  }, [keywords, mode, sort, searchType, selectedCategories]);

  const saveToPipeline = (app: AcquisitionApp) => {
    if (pipeline.some((a) => a.appId === app.appId)) return;
    const saved = { ...app, savedAt: new Date().toISOString() };
    const next = [...pipeline, saved];
    setPipeline(next);
    persist(next);
  };

  const removeFromPipeline = (appId: string) => {
    const next = pipeline.filter((a) => a.appId !== appId);
    setPipeline(next);
    persist(next);
    if (selectedApp?.appId === appId) {
      setSelectedApp(null);
      setView("search");
    }
  };

  const updateStatus = (appId: string, status: OutreachStatus) => {
    const next = pipeline.map((a) =>
      a.appId === appId
        ? { ...a, outreachStatus: status, outreachDate: new Date().toISOString() }
        : a
    );
    setPipeline(next);
    persist(next);
    if (selectedApp?.appId === appId) {
      setSelectedApp((p) => (p ? { ...p, outreachStatus: status, outreachDate: new Date().toISOString() } : null));
    }
  };

  const saveNotes = () => {
    if (!selectedApp) return;
    const next = pipeline.map((a) =>
      a.appId === selectedApp.appId ? { ...a, notes } : a
    );
    setPipeline(next);
    persist(next);
    setSelectedApp((p) => (p ? { ...p, notes } : null));
  };

  const viewDetail = (app: AcquisitionApp) => {
    const saved = pipeline.find((a) => a.appId === app.appId);
    setSelectedApp(saved ?? app);
    setView("detail");
  };

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSuggested = (kw: string) => {
    const existing = keywords
      .split(/[\n,]+/)
      .map((k) => k.trim().toLowerCase());
    if (existing.includes(kw.toLowerCase())) return;
    setKeywords((prev) => (prev ? `${prev}\n${kw}` : kw));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInPipeline = (appId: string) => pipeline.some((a) => a.appId === appId);

  const filteredPipeline =
    statusFilter === "all"
      ? pipeline
      : pipeline.filter((a) => a.outreachStatus === statusFilter);

  const statusCounts = OUTREACH_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s.value]: pipeline.filter((a) => a.outreachStatus === s.value).length }),
    {} as Record<string, number>
  );

  const templates: OutreachTemplate[] = selectedApp
    ? getTemplates(selectedApp.name, selectedApp.developer)
    : [];
  const currentTemplate = templates.find((t) => t.id === templateId) ?? templates[0];

  const ts = new Date().toISOString().slice(0, 10);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      {/* Header with search */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">App Acquisition Finder</h1>
              <p className="text-[11px] text-muted-foreground">
                Find neglected apps from small devs who moved on
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {searching ? (
              <Button variant="outline" size="sm" disabled className="gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Searching...
              </Button>
            ) : (
              <Button size="sm" onClick={handleSearch} className="gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                Search
              </Button>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Find:</span>
          {DISCOVER_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                mode === m.value
                  ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Sort:</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                sort === s.value
                  ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search type toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">By:</span>
          <button
            onClick={() => setSearchType("categories")}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
              searchType === "categories"
                ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setSearchType("keywords")}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
              searchType === "keywords"
                ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
            }`}
          >
            Keywords
          </button>
        </div>

        {/* Category picker (default) OR Keyword input */}
        {searchType === "categories" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {APP_STORE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  disabled={searching}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    selectedCategories.has(cat.id)
                      ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {selectedCategories.size > 0 && (
              <p className="text-[11px] text-primary font-medium">
                {selectedCategories.size} categor{selectedCategories.size !== 1 ? "ies" : "y"} selected — will browse top charts for each
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter keywords (one per line or comma-separated):&#10;calculator&#10;weather&#10;todo list"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={searching}
              rows={3}
              className="font-mono text-sm resize-none bg-input/50 border-border focus:border-primary/50"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground shrink-0">Suggested:</span>
              {SUGGESTED_KEYWORDS.slice(0, 12).map((kw) => (
                <button
                  key={kw}
                  onClick={() => addSuggested(kw)}
                  disabled={searching}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" />
            </svg>
            {error}
          </div>
        )}
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Pipeline Sidebar ────────────────────────────── */}
        <aside className="w-72 border-r border-border bg-sidebar flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Pipeline</h2>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {pipeline.length} app{pipeline.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="px-3 pt-2 flex flex-wrap gap-1">
            <button
              className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                statusFilter === "all"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setStatusFilter("all")}
            >
              All ({pipeline.length})
            </button>
            {OUTREACH_STATUSES.map((s) => (
              <button
                key={s.value}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                  statusFilter === s.value
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setStatusFilter(s.value)}
              >
                {s.label} ({statusCounts[s.value] ?? 0})
              </button>
            ))}
          </div>

          {/* Pipeline app list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {filteredPipeline.map((app) => (
              <div
                key={app.appId}
                className={`p-2.5 rounded-xl cursor-pointer transition-all border ${
                  selectedApp?.appId === app.appId
                    ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                    : "bg-card/50 border-transparent hover:bg-card hover:border-border"
                }`}
                onClick={() => viewDetail(app)}
              >
                <div className="flex items-start gap-2">
                  {app.icon && (
                    <img src={app.icon} alt="" className="w-8 h-8 rounded-lg shrink-0 ring-1 ring-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs truncate">{app.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{app.developer}</p>
                  </div>
                  <StatusBadge status={app.outreachStatus} />
                </div>
              </div>
            ))}
            {pipeline.length === 0 && (
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
                <p className="text-[11px] text-center">Search and save apps<br />to build your pipeline</p>
              </div>
            )}
          </div>

          {/* Export buttons */}
          {pipeline.length > 0 && (
            <div className="px-3 py-2 border-t border-border flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadAcquisitionCSV(pipeline, `pipeline_${ts}.csv`)}
                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground flex-1"
              >
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadAcquisitionJSON(pipeline, `pipeline_${ts}.json`)}
                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground flex-1"
              >
                JSON
              </Button>
            </div>
          )}
        </aside>

        {/* ─── Main Content ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {view === "detail" && selectedApp ? (
            <AppDetail
              app={selectedApp}
              isInPipeline={isInPipeline(selectedApp.appId)}
              onBack={() => { setView("search"); setSelectedApp(null); }}
              onSave={() => saveToPipeline(selectedApp)}
              onRemove={() => removeFromPipeline(selectedApp.appId)}
              onUpdateStatus={(s) => updateStatus(selectedApp.appId, s)}
              templateId={templateId}
              onTemplateChange={setTemplateId}
              templates={templates}
              currentTemplate={currentTemplate}
              copied={copied}
              onCopy={handleCopy}
              notes={notes}
              onNotesChange={setNotes}
              onSaveNotes={saveNotes}
            />
          ) : (
            <SearchResults
              results={results}
              searching={searching}
              isInPipeline={isInPipeline}
              onSave={saveToPipeline}
              onViewDetail={viewDetail}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Search Results ──────────────────────────────────────────────

function SearchResults({
  results,
  searching,
  isInPipeline,
  onSave,
  onViewDetail,
}: {
  results: AcquisitionApp[];
  searching: boolean;
  isInPipeline: (id: string) => boolean;
  onSave: (app: AcquisitionApp) => void;
  onViewDetail: (app: AcquisitionApp) => void;
}) {
  if (searching) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <p className="text-sm">Searching the App Store for abandoned apps...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Find apps to acquire</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Search by keywords or browse App Store categories. Switch between Abandoned, New, Popular, and High Rated modes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="px-6 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Found <span className="text-foreground font-medium">{results.length}</span> app{results.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="p-6 space-y-2.5">
        {results.map((app) => (
          <div
            key={app.appId}
            className="rounded-xl border border-border bg-card/60 p-4 hover:bg-card/80 transition-colors"
          >
            <div className="flex items-start gap-4">
              {app.icon && (
                <img src={app.icon} alt="" className="w-12 h-12 rounded-xl shrink-0 ring-1 ring-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm truncate">{app.name}</p>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">
                    {app.formattedPrice}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {app.developer} &middot; {app.category}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">&#9733;</span>
                    {app.averageRating.toFixed(1)}
                  </span>
                  <span>{formatNumber(app.ratingCount)} ratings</span>
                  <span className="text-orange-400 font-medium">
                    {app.daysSinceUpdate}d since update
                  </span>
                  {app.lastUpdated && (
                    <span>Last: {formatDate(app.lastUpdated)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isInPipeline(app.appId) ? (
                  <span className="text-[11px] text-primary font-medium px-3 py-1.5 rounded-lg bg-primary/10">
                    Saved
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSave(app)}
                    className="text-xs gap-1.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Save
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onViewDetail(app)} className="text-xs">
                  Details &rarr;
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Detail + Outreach ───────────────────────────────────────

function AppDetail({
  app,
  isInPipeline,
  onBack,
  onSave,
  onRemove,
  onUpdateStatus,
  templateId,
  onTemplateChange,
  templates,
  currentTemplate,
  copied,
  onCopy,
  notes,
  onNotesChange,
  onSaveNotes,
}: {
  app: AcquisitionApp;
  isInPipeline: boolean;
  onBack: () => void;
  onSave: () => void;
  onRemove: () => void;
  onUpdateStatus: (s: OutreachStatus) => void;
  templateId: string;
  onTemplateChange: (id: string) => void;
  templates: OutreachTemplate[];
  currentTemplate?: OutreachTemplate;
  copied: boolean;
  onCopy: (text: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to results
      </button>

      {/* App header */}
      <div className="flex items-start gap-4">
        {app.icon && (
          <img src={app.icon} alt="" className="w-16 h-16 rounded-2xl shrink-0 ring-1 ring-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold truncate">{app.name}</h2>
            <StatusBadge status={app.outreachStatus} />
          </div>
          <p className="text-sm text-muted-foreground">{app.developer}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{app.formattedPrice}</span>
            <span>{app.category}</span>
            <span className="flex items-center gap-1">
              <span className="text-yellow-400">&#9733;</span>
              {app.averageRating.toFixed(1)} ({formatNumber(app.ratingCount)})
            </span>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{app.daysSinceUpdate}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Days Since Update</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
          <p className="text-2xl font-bold">{formatNumber(app.ratingCount)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total Ratings (~{formatNumber(app.ratingCount * 80)} downloads)</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3 text-center">
          <p className="text-2xl font-bold">{formatDate(app.lastUpdated)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Last Updated</p>
        </div>
      </div>

      {/* Links */}
      <div className="flex items-center gap-3 flex-wrap">
        <a
          href={app.trackViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          App Store
        </a>
        {app.sellerUrl && (
          <a
            href={app.sellerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Developer Website
          </a>
        )}
        {isInPipeline ? (
          <Button variant="outline" size="sm" onClick={onRemove} className="text-xs gap-1.5 text-destructive hover:text-destructive">
            Remove from Pipeline
          </Button>
        ) : (
          <Button size="sm" onClick={onSave} className="text-xs gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Save to Pipeline
          </Button>
        )}
      </div>

      {/* Description */}
      {app.description && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{app.description}</p>
        </div>
      )}

      {/* Pipeline controls (only if saved) */}
      {isInPipeline && (
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Pipeline Management</h3>

          {/* Status selector */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Outreach Status
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTREACH_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onUpdateStatus(s.value)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                    app.outreachStatus === s.value
                      ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-primary/20 hover:bg-muted"
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${s.color}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onSaveNotes}
              placeholder="Add notes about this app, contact attempts, responses..."
              rows={3}
              className="text-sm resize-none bg-input/50 border-border focus:border-primary/50"
            />
          </div>
        </div>
      )}

      {/* Outreach section */}
      {isInPipeline && templates.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Outreach Generator</h3>
            <div className="flex gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTemplateChange(t.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                    templateId === t.id
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {currentTemplate && (
            <>
              {currentTemplate.subject && (
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Subject
                  </label>
                  <div className="text-sm px-3 py-2 rounded-lg bg-muted/50 border border-border font-medium">
                    {currentTemplate.subject}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  {currentTemplate.type === "email" ? "Email Body" : "Message"}
                </label>
                <pre className="text-sm px-3 py-2.5 rounded-lg bg-muted/50 border border-border whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                  {currentTemplate.body}
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onCopy(getFullEmail(currentTemplate))}
                  className="text-xs gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                {currentTemplate.type === "email" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const mailto = `mailto:?subject=${encodeURIComponent(currentTemplate.subject ?? "")}&body=${encodeURIComponent(currentTemplate.body)}`;
                      window.open(mailto);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    Open in Email Client
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
