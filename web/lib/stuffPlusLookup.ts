export interface StuffPlusLookupPitch {
  pitchType: string;
  meanStuffPlus: number | null;
  nSessions?: number | null;
}

export interface StuffPlusLookupResult {
  lookupPlayerId: string | null;
  pitches: StuffPlusLookupPitch[];
  error: string | null;
}

function reversedSlug(value: string): string | null {
  const parts = value.split("_").filter(Boolean);
  if (parts.length !== 2) return null;
  return `${parts[1]}_${parts[0]}`;
}

export function buildStuffPlusLookupCandidates(
  values: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    ordered.push(trimmed);
  };

  for (const value of values) {
    push(value);
    if (value?.includes("_")) {
      push(reversedSlug(value));
    }
  }

  return ordered;
}

export async function fetchStuffPlusByCandidates(
  candidates: string[],
): Promise<StuffPlusLookupResult> {
  let lastError: string | null = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `/api/stuff-plus/arsenal?playerId=${encodeURIComponent(candidate)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        lastError = `stuff_plus_${response.status}`;
        continue;
      }

      const payload = (await response.json()) as {
        pitches?: Array<{
          pitchType?: string;
          meanStuffPlus?: number | null;
          nSessions?: number | null;
        }>;
      };

      const pitches = Array.isArray(payload?.pitches)
        ? payload.pitches
            .map((row) => ({
              pitchType: row.pitchType?.trim() ?? "",
              meanStuffPlus:
                typeof row.meanStuffPlus === "number" ? row.meanStuffPlus : null,
              nSessions:
                typeof row.nSessions === "number" ? row.nSessions : null,
            }))
            .filter((row) => row.pitchType.length > 0)
        : [];

      if (pitches.length > 0) {
        return {
          lookupPlayerId: candidate,
          pitches,
          error: null,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "stuff_load_error";
    }
  }

  return {
    lookupPlayerId: candidates[0] ?? null,
    pitches: [],
    error: lastError,
  };
}
