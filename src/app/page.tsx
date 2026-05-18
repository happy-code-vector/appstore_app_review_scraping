"use client";

import { useState } from "react";
import { TabNav } from "@/components/tab-nav";
import { ReviewScraperTab } from "@/components/review-scraper-tab";
import { AcquireTab } from "@/components/acquire-tab";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"reviews" | "acquire">("reviews");

  return (
    <div className="h-screen flex flex-col bg-background">
      <TabNav activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex flex-1 min-h-0 flex-col">
        {activeTab === "reviews" ? <ReviewScraperTab /> : <AcquireTab />}
      </div>
    </div>
  );
}
