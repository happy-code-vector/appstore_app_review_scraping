import { NextRequest, NextResponse } from "next/server";
import { discoverApps, discoverByCategory } from "@/lib/discover";
import { DiscoverMode, SortOption } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, categoryIds, mode, sort } = body as {
    keywords?: string[];
    categoryIds?: number[];
    mode?: DiscoverMode;
    sort?: SortOption;
  };

  const discoverMode: DiscoverMode = mode ?? "abandoned";
  const sortOption: SortOption = sort ?? "most_ratings";

  try {
    let apps;

    if (categoryIds && categoryIds.length > 0) {
      apps = await discoverByCategory(categoryIds, discoverMode, sortOption);
    } else if (keywords && keywords.length > 0) {
      apps = await discoverApps(keywords, discoverMode, sortOption);
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
