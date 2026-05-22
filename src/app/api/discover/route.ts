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

  // Separate cached vs uncached items
  let items: { cacheKey: string; cached: AcquisitionApp[] | null; fetch: () => Promise<AcquisitionApp[]> }[];

  if (categoryIds && categoryIds.length > 0) {
    items = categoryIds.map((id) => {
      const cacheKey = makeCategoryKey(id, sortOption);
      const cached = getCached<AcquisitionApp[]>(cacheKey);
      return { cacheKey, cached, fetch: () => discoverSingleCategory(id, sortOption) };
    });
  } else if (keywords && keywords.length > 0) {
    items = keywords.map((kw) => {
      const cacheKey = makeKeywordKey(kw, sortOption);
      const cached = getCached<AcquisitionApp[]>(cacheKey);
      return { cacheKey, cached, fetch: () => discoverSingleKeyword(kw, sortOption) };
    });
  } else {
    return NextResponse.json(
      { error: "Provide either keywords or categoryIds" },
      { status: 400 }
    );
  }

  // Fetch all uncached items in parallel
  const uncached = items.filter((i) => !i.cached);
  const results = await Promise.all(uncached.map((i) => i.fetch()));

  // Cache newly fetched results and merge with cached ones
  const allApps = new Map<string, AcquisitionApp>();

  for (const item of items) {
    let apps: AcquisitionApp[];
    if (item.cached) {
      apps = item.cached;
    } else {
      apps = results.shift() ?? [];
      setCache(item.cacheKey, apps);
    }

    for (const app of apps) {
      if (!allApps.has(app.appId)) {
        allApps.set(app.appId, app);
      }
    }
  }

  return NextResponse.json({ apps: Array.from(allApps.values()), total: allApps.size });
}
