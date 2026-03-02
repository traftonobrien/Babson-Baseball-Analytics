import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
