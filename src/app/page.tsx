"use client";

import { useState, useCallback, useRef } from "react";
import { AppInput } from "@/components/app-input";
import { RatingFilter } from "@/components/rating-filter";
import { Sidebar } from "@/components/sidebar";
import { ReviewFeed } from "@/components/review-feed";
import { Button } from "@/components/ui/button";
import { parseAppIds } from "@/lib/parse-app-ids";
import { AppScrapeResult, Review, ScrapeEvent } from "@/lib/types";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [ratingFilter, setRatingFilter] = useState("1,2");
  const [scraping, setScraping] = useState(false);
  const [apps, setApps] = useState<AppScrapeResult[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filteredReviews = selectedAppId
    ? allReviews.filter((r) => r.appId === selectedAppId)
    : allReviews;

  const handleScrape = useCallback(async () => {
    const ids = parseAppIds(inputText);
    if (ids.length === 0) {
      setError("No valid app IDs found. Paste IDs or App Store URLs.");
      return;
    }

    const ratings = ratingFilter.split(",").map(Number).filter((n) => n >= 1 && n <= 5);
    if (ratings.length === 0) {
      setError("Select a rating filter.");
      return;
    }

    setError(null);
    setScraping(true);
    setApps([]);
    setAllReviews([]);
    setSelectedAppId(null);
    setProgress({ done: 0, total: ids.length });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: ids, ratings, maxReviews: 500 }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError(`Scrape failed: ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = 0;

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: ScrapeEvent = JSON.parse(line.slice(6));

            if (event.type === "app") {
              setApps((prev) => [...prev, event.data]);
              setAllReviews((prev) => [...prev, ...event.data.reviews]);
              done++;
              setProgress((prev) => ({ ...prev, done }));
            } else if (event.type === "error") {
              done++;
              setProgress((prev) => ({ ...prev, done }));
            } else if (event.type === "done") {
              setProgress({ done: event.totalApps, total: event.totalApps });
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(`Scrape error: ${(e as Error).message}`);
      }
    } finally {
      setScraping(false);
      abortRef.current = null;
    }
  }, [inputText, ratingFilter]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleFileLoad = (ids: string[]) => {
    setInputText(ids.join("\n"));
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M8 5V11M5 7L8 5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">App Store Review Scraper</h1>
              <p className="text-[11px] text-muted-foreground">Scrape and filter iOS reviews by rating</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RatingFilter value={ratingFilter} onChange={setRatingFilter} disabled={scraping} />
            {scraping ? (
              <Button variant="destructive" size="sm" onClick={handleStop} className="gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={handleScrape} className="gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                Scrape
              </Button>
            )}
          </div>
        </div>
        <AppInput
          value={inputText}
          onChange={setInputText}
          onFileLoad={handleFileLoad}
          disabled={scraping}
        />
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
            </svg>
            {error}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          apps={apps}
          selectedAppId={selectedAppId}
          onSelectApp={setSelectedAppId}
          progress={progress}
        />
        <ReviewFeed reviews={filteredReviews} totalScraped={allReviews.length} />
      </div>
    </div>
  );
}
