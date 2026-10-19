import type { NextRequest } from "next/server";
import type { NewsItem } from "@/lib/types";
import { mockNews } from "@/lib/server/mock";
import { serve } from "@/lib/server/respond";
import { yahooNews } from "@/lib/server/yahoo";

const TOPICS: Record<string, string[]> = {
  markets: ["stock market", "S&P 500", "Federal Reserve", "treasury yields"],
  global: ["European stocks", "Asian markets", "ECB", "China economy"],
  macro: ["inflation", "jobs report", "central bank", "oil prices"],
};

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get("topic") ?? "markets";
  const queries = TOPICS[topic] ?? TOPICS.markets;
  return serve({
    key: `news:topic:${topic}`,
    ttl: 600,
    load: async () => {
      const results = await Promise.allSettled(queries.map((q) => yahooNews(q, 10)));
      const seen = new Set<string>();
      const data: NewsItem[] = results
        .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        .filter((n) => (seen.has(n.title) ? false : (seen.add(n.title), true)))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 30);
      if (!data.length) throw new Error("no news");
      return { data, source: "yahoo" };
    },
    fallback: () => mockNews(topic),
  });
}
