import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  // impit ships a native (Rust) binary; keep it out of the server bundle so the .node file is traced as-is.
  serverExternalPackages: ["impit"],
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
