import { metricLabel } from "@/lib/mechanics/labels";
import { isMajorityLowConfidence } from "@/lib/mechanics/selectors";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsConfidencePanelProps {
  notes: NotesJson;
}

export function MechanicsConfidencePanel({ notes }: MechanicsConfidencePanelProps) {
  const { limitations } = notes;
  const hasContent =
    limitations.not_measurable.length > 0 || limitations.low_confidence_metrics.length > 0;

  if (!hasContent) return null;

  const majorityLow = isMajorityLowConfidence(notes);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">
        Mechanics Context
      </h2>

      {majorityLow && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-3">
          <span className="text-amber-500 text-xs shrink-0">△</span>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            Most metrics in this session have low confidence. Scores reflect what the model can
            infer from this camera angle. Cross-reference with film before making coaching
            decisions.
          </p>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Camera View */}
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Camera View</p>
          <p className="text-sm font-medium text-zinc-300 capitalize mb-1">
            {limitations.camera_view.replace(/_/g, " ")}
          </p>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Metric availability varies by angle. Some measurements require additional views.
          </p>
        </div>

        {/* Not Measurable */}
        {limitations.not_measurable.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">
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

        {/* Low Confidence */}
        {limitations.low_confidence_metrics.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">
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
