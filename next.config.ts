import type { NextConfig } from "next";

const siteHost = new URL(process.env.SITE_URL || "https://stockanalyses.org").host;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  // impit ships a native (Rust) binary; keep it out of the server bundle so the .node file is traced as-is.
  serverExternalPackages: ["impit"],
  // Host-level www -> apex redirect, so it also holds on Cloud Run or if the Vercel domain redirect is missing.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: `www.${siteHost}` }], destination: `https://${siteHost}/:path*`, permanent: true }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.yimg.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
