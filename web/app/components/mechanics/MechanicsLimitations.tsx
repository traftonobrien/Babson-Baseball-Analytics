import { metricLabel } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsLimitationsProps {
  notes: NotesJson;
}

export function MechanicsLimitations({ notes }: MechanicsLimitationsProps) {
  const { limitations } = notes;
  const hasContent =
    limitations.not_measurable.length > 0 ||
    limitations.low_confidence_metrics.length > 0;

  if (!hasContent) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Camera Limitations</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Camera view */}
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Camera View</p>
          <p className="text-sm font-medium text-zinc-300 capitalize">
            {limitations.camera_view.replace(/_/g, " ")}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Some metrics require a front or additional view angle.
          </p>
        </div>

        {/* Not measurable */}
        {limitations.not_measurable.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Not Measurable</p>
            <div className="space-y-1">
              {limitations.not_measurable.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                  <span className="text-xs text-zinc-500">{metricLabel(k)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low confidence */}
        {limitations.low_confidence_metrics.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Low Confidence</p>
            <div className="space-y-1">
              {limitations.low_confidence_metrics.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-amber-700" />
                  <span className="text-xs text-zinc-500">{metricLabel(k)}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
              Scores penalized. Review film before coaching on these.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
