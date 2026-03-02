import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling media files in public/data into
  // serverless function packages. CSVs are read at runtime via fs;
  // clips and overlays are served as static assets, never bundled.
  outputFileTracingExcludes: {
    "*": [
      "./public/data/**/*.mp4",
      "./public/data/**/*.png",
      "./public/data/**/*.jpg",
      "./public/data/**/*.jpeg",
      "./public/data/**/*.webp",
    ],
  },
};

export default nextConfig;
