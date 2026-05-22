import { NextRequest, NextResponse } from "next/server";
import { discoverSingleCategory, discoverSingleKeyword } from "@/lib/discover";
import { AcquisitionApp, SortOption } from "@/lib/types";
import { getCached, setCache, makeCategoryKey, makeKeywordKey } from "@/lib/cache";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, categoryIds, sort } = body as {
    keywords?: string[];
    categoryIds?: number[];
    sort?: SortOption;
  };

  const sortOption: SortOption = sort ?? "most_ratings";
  const allApps = new Map<string, AcquisitionApp>();

  if (categoryIds && categoryIds.length > 0) {
    // Per-category: check cache for each, fetch missing ones
    for (const genreId of categoryIds) {
      const cacheKey = makeCategoryKey(genreId, sortOption);
      let apps = getCached<AcquisitionApp[]>(cacheKey);

      if (!apps) {
        apps = await discoverSingleCategory(genreId, sortOption);
        setCache(cacheKey, apps);
      }

      for (const app of apps) {
        if (!allApps.has(app.appId)) {
          allApps.set(app.appId, app);
        }
      }
    }
  } else if (keywords && keywords.length > 0) {
    // Per-keyword: check cache for each, fetch missing ones
    for (const keyword of keywords) {
      const cacheKey = makeKeywordKey(keyword, sortOption);
      let apps = getCached<AcquisitionApp[]>(cacheKey);

      if (!apps) {
        apps = await discoverSingleKeyword(keyword, sortOption);
        setCache(cacheKey, apps);
      }

      for (const app of apps) {
        if (!allApps.has(app.appId)) {
          allApps.set(app.appId, app);
        }
      }
    }
  } else {
    return NextResponse.json(
      { error: "Provide either keywords or categoryIds" },
      { status: 400 }
    );
  }

  return NextResponse.json({ apps: Array.from(allApps.values()), total: allApps.size });
}
