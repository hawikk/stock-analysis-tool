import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// API routes call rate-limited upstreams (including free AI quotas), so crawlers are kept to the pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    host: SITE_URL,
  };
}
