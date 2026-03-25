import { motion } from "framer-motion";

interface EndInningModalProps {
  completedHalfLabel: string;
  nextHalfLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const EndInningModal = ({
  completedHalfLabel,
  nextHalfLabel,
  onConfirm,
  onDismiss,
}: EndInningModalProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-inning-title"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xs rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.94),rgba(9,9,11,0.98))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
      >
        <div className="border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            3 Outs
          </div>
          <h2 id="end-inning-title" className="text-base font-bold text-zinc-100">
            {completedHalfLabel} complete
          </h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-zinc-400">
            End the inning and advance to{" "}
            <span className="font-semibold text-zinc-200">{nextHalfLabel}</span>?
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-[rgba(var(--babson-green-rgb),0.35)] bg-[rgba(var(--babson-green-rgb),0.12)] px-4 py-2 text-xs font-bold text-[var(--babson-green)] transition-colors hover:bg-[rgba(var(--babson-green-rgb),0.2)]"
          >
            Yes, {nextHalfLabel} →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
