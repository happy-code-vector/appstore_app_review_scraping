import { NextRequest, NextResponse } from "next/server";
import { discoverApps, discoverByCategory } from "@/lib/discover";
import { DiscoverMode } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, categoryIds, filters, mode } = body as {
    keywords?: string[];
    categoryIds?: number[];
    filters: {
      minRatingCount: number;
      minDaysSinceUpdate: number;
      maxPrice: number;
      minAverageRating: number;
    };
    mode?: DiscoverMode;
  };

  const discoverMode: DiscoverMode = mode ?? "abandoned";

  try {
    let apps;

    if (categoryIds && categoryIds.length > 0) {
      // Category browsing mode
      apps = await discoverByCategory(categoryIds, discoverMode, filters);
    } else if (keywords && keywords.length > 0) {
      // Keyword search mode
      apps = await discoverApps(keywords, filters, discoverMode);
    } else {
      return NextResponse.json(
        { error: "Provide either keywords or categoryIds" },
        { status: 400 }
      );
    }

    return NextResponse.json({ apps, total: apps.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
