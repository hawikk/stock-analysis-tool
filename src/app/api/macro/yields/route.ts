import { connection } from "next/server";
import { treasuryCurve } from "@/lib/server/macro";
import { mockYieldCurve } from "@/lib/server/mock";
import { serve } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return serve({
    key: "macro:yields",
    ttl: 3600,
    maxAge: 600,
    load: async () => ({ data: await treasuryCurve(), source: "treasury" }),
    fallback: mockYieldCurve,
  });
}
