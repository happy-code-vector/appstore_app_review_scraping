import { NextRequest, NextResponse } from "next/server";
import { discoverApps, discoverByCategory } from "@/lib/discover";
import { SortOption } from "@/lib/types";
import { getCached, setCache, makeCacheKey } from "@/lib/cache";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, categoryIds, sort } = body as {
    keywords?: string[];
    categoryIds?: number[];
    sort?: SortOption;
  };

  const sortOption: SortOption = sort ?? "most_ratings";

  // Build cache key from search params
  const cacheKey = makeCacheKey({
    type: categoryIds?.length ? "category" : "keyword",
    categoryIds: categoryIds?.sort(),
    keywords: keywords?.map((k) => k.trim().toLowerCase()).sort(),
    sort: sortOption,
  });

  // Check cache first
  const cached = getCached<{ apps: unknown[]; total: number }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    let apps;

    if (categoryIds && categoryIds.length > 0) {
      apps = await discoverByCategory(categoryIds, sortOption);
    } else if (keywords && keywords.length > 0) {
      apps = await discoverApps(keywords, sortOption);
    } else {
      return NextResponse.json(
        { error: "Provide either keywords or categoryIds" },
        { status: 400 }
      );
    }

    const result = { apps, total: apps.length };
    setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
