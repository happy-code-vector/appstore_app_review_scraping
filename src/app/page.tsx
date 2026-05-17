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
    <div className="h-screen flex flex-col">
      {/* Header / Input */}
      <header className="border-b p-4 space-y-3 bg-background">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">App Store Review Scraper</h1>
          <div className="flex items-center gap-3">
            <RatingFilter value={ratingFilter} onChange={setRatingFilter} disabled={scraping} />
            {scraping ? (
              <Button variant="destructive" size="sm" onClick={handleStop}>
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={handleScrape}>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </header>

      {/* Body: Sidebar + Feed */}
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
