import { connection } from "next/server";
import { globalBonds } from "@/lib/server/macro";
import { mockBonds } from "@/lib/server/mock";
import { serve } from "@/lib/server/respond";

export async function GET() {
  await connection();
  return serve({
    key: "macro:bonds",
    ttl: 120,
    load: async () => ({ data: await globalBonds(), source: "cnbc" }),
    fallback: mockBonds,
  });
}
