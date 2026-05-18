import { NextRequest, NextResponse } from "next/server";
import { discoverApps } from "@/lib/discover";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, filters } = body as {
    keywords: string[];
    filters: {
      minRatingCount: number;
      minDaysSinceUpdate: number;
      maxPrice: number;
      minAverageRating: number;
    };
  };

  if (!keywords?.length) {
    return NextResponse.json(
      { error: "No keywords provided" },
      { status: 400 }
    );
  }

  try {
    const apps = await discoverApps(keywords, filters);
    return NextResponse.json({ apps, total: apps.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
