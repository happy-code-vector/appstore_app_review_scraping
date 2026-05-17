import { NextRequest } from "next/server";
import { fetchReviews } from "@/lib/scraper";
import { ScrapeEvent } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { appIds, ratings, maxReviews = 500 } = body as {
    appIds: string[];
    ratings: number[];
    maxReviews?: number;
  };

  if (!appIds?.length || !ratings?.length) {
    return new Response("Missing appIds or ratings", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScrapeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let totalReviews = 0;

      for (const appId of appIds) {
        try {
          const result = await fetchReviews(appId, ratings, maxReviews);
          if (result) {
            totalReviews += result.reviews.length;
            send({ type: "app", data: result });
          } else {
            send({ type: "error", appId, error: "No data returned" });
          }
        } catch (e) {
          send({ type: "error", appId, error: String(e) });
        }
      }

      send({ type: "done", totalApps: appIds.length, totalReviews });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
