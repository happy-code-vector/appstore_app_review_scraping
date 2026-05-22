import { NextRequest, NextResponse } from "next/server";
import { discoverApps, discoverByCategory } from "@/lib/discover";
import { SortOption } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, categoryIds, sort } = body as {
    keywords?: string[];
    categoryIds?: number[];
    sort?: SortOption;
  };

  const sortOption: SortOption = sort ?? "most_ratings";

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

    return NextResponse.json({ apps, total: apps.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
