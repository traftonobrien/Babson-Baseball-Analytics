import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy directives
// - unsafe-inline + unsafe-eval required by Next.js App Router hydration scripts
// - va.vercel-scripts.com: Vercel Analytics script host
// - vitals.vercel-insights.com: Vercel Analytics beacon endpoint
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // Prevent the app from being framed (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer info sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 1 year (only meaningful on HTTPS, harmless on HTTP)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Disable browser features not used by the app
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content Security Policy
  { key: "Content-Security-Policy", value: CSP },
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // Legacy charting login → main login
      {
        source: "/charting-login",
        destination: "/login",
        permanent: true,
      },
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
