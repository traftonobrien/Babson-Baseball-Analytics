/**
 * Team identity configuration.
 *
 * NEXT_PUBLIC_TEAM_NAME is set in Vercel environment variables.
 * It is read at build time for client components and at runtime for server components.
 *
 * Default: "Babson" — so existing deployments are unchanged until overridden.
 */
export const TEAM_NAME: string =
  process.env.NEXT_PUBLIC_TEAM_NAME ?? "Babson";

/**
 * Server-side helper that returns the active team config.
 * Extend this object as Phase 18 adds logo, colors, and branding fields.
 */
export function getTeamConfig() {
  return {
    name: TEAM_NAME,
  };
}
