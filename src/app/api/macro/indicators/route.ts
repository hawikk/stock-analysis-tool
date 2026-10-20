import { connection } from "next/server";
import { macroIndicators } from "@/lib/server/macro";
import { serve } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return serve({
    key: "macro:indicators",
    ttl: 6 * 3600,
    maxAge: 3600,
    load: async () => ({ data: await macroIndicators(), source: "fred" }),
  });
}
