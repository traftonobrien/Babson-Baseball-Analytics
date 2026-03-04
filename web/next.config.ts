import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: configDir,
  },
  // Prevent Next.js from bundling media files into serverless function
  // packages. These are served as static assets at runtime, never imported.
  outputFileTracingExcludes: {
    "/**": [
      "./public/data/**/*.mp4",
      "./public/data/**/*.png",
      "./public/data/**/*.jpg",
      "./public/data/**/*.jpeg",
      "./public/data/**/*.webp",
      "./public/mechanics/**/*.mp4",
      "./public/mechanics/**/*.png",
      "./public/mechanics/**/*.jpg",
      "./public/mechanics/**/*.jpeg",
      "./public/mechanics/**/*.webp",
    ],
  },
  async redirects() {
    return [
      {
        source: "/leaderboards",
        destination: "/command/leaderboard",
        permanent: true,
      },
      {
        source: "/leaderboards/faq",
        destination: "/command/faq",
        permanent: true,
      },
      {
        source: "/leaderboards/plus",
        destination: "/pitching-plus/leaderboard",
        permanent: true,
      },
      {
        source: "/trackman/leaderboards",
        destination: "/trackman/leaderboard",
        permanent: true,
      },
      {
        source: "/team-stats",
        destination: "/team-stats/leaderboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
