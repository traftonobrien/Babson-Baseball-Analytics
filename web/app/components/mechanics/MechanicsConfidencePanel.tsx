import { metricLabel } from "@/lib/mechanics/labels";
import { isMajorityLowConfidence } from "@/lib/mechanics/selectors";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsConfidencePanelProps {
  notes: NotesJson;
}

export function MechanicsConfidencePanel({ notes }: MechanicsConfidencePanelProps) {
  const { limitations } = notes;
  const hasMeta = !!(notes.pose_backend || notes.angle_validated !== undefined);
  const hasContent =
    limitations.not_measurable.length > 0 ||
    limitations.low_confidence_metrics.length > 0 ||
    hasMeta;

  if (!hasContent) return null;

  const majorityLow = isMajorityLowConfidence(notes);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Mechanics Context
        </h2>
        <p className="mt-1 text-xs text-zinc-600">Camera angle and confidence notes that affect how aggressively to coach this session.</p>
      </div>

      {majorityLow && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-800/40 bg-amber-950/30 px-4 py-3">
          <span className="text-amber-500 text-xs shrink-0">△</span>
          <p className="text-xs text-amber-300/80">
            Most metrics have low confidence this session. Cross-reference with film.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-3 rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <div>
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Camera View</p>
            <p className="text-sm font-medium text-zinc-300 capitalize">
              {limitations.camera_view.replace(/_/g, " ")}
            </p>
          </div>

          {notes.pose_backend && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                Pose: {notes.pose_backend === "vitpose" ? "ViTPose" : "MediaPipe"}
              </span>
            </div>
          )}

          {notes.angle_validated !== undefined && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${
                  notes.angle_validated
                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                    : "bg-amber-950/30 text-amber-400 border border-amber-800/40"
                }`}
              >
                {notes.angle_validated ? "Open-side validated" : "Angle not validated"}
              </span>
              {notes.angle_confidence !== undefined && (
                <span className="text-[10px] text-zinc-600">
                  {Math.round(notes.angle_confidence * 100)}%
                </span>
              )}
            </div>
          )}
        </div>

        {limitations.not_measurable.length > 0 && (
          <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Not Measurable
            </p>
            <div className="space-y-1.5">
              {limitations.not_measurable.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />
                  <span className="text-xs text-zinc-500">{metricLabel(k)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {limitations.low_confidence_metrics.length > 0 && (
          <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Low Confidence
            </p>
            <div className="space-y-1.5">
              {limitations.low_confidence_metrics.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-amber-700 shrink-0" />
                  <span className="text-xs text-zinc-500">{metricLabel(k)}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2.5 leading-relaxed">
              Scores penalized. Confirm against film.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
