import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import { HIT_OPTIONS, type PAResultType } from "@/lib/charting/live";

import {
  HIT_LABELS,
  OUT_TYPE_CHOICES,
  OUT_TYPE_LABELS,
  OUT_TYPE_TO_OPTIONS,
  WIZARD_BTN,
} from "./constants";
import type { InPlayOutType, InPlayStep } from "./types";

interface ChartingEditorInPlayModalProps {
  step: InPlayStep;
  outType: InPlayOutType | null;
  onSelect: (result: PAResultType) => void;
  onStepChange: (step: InPlayStep) => void;
  onOutTypeChange: (type: InPlayOutType | null) => void;
  paResultOutsRecorded: (result: PAResultType) => number;
}

export const ChartingEditorInPlayModal = ({
  step,
  outType,
  onSelect,
  onStepChange,
  onOutTypeChange,
  paResultOutsRecorded,
}: ChartingEditorInPlayModalProps) => {
  const showBackButton =
    step === "hit_type" || step === "out_type" || step === "out_scoring";

  const handleBack = () => {
    if (step === "out_scoring") {
      onStepChange("out_type");
      onOutTypeChange(null);
      return;
    }

    onStepChange("hit_or_out");
    if (step === "out_type") {
      onOutTypeChange(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="in-play-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.92),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
      >
        <div className="shrink-0 border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showBackButton ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-100"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : null}
              <div>
                <h2 id="in-play-modal-title" className="text-lg font-bold text-zinc-100">
                  Ball in Play
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {step === "hit_or_out" ? "Hit or out?" : null}
                  {step === "hit_type" ? "Single, double, triple, or home run?" : null}
                  {step === "out_type" ? "What kind of out?" : null}
                  {step === "out_scoring" && outType
                    ? `Select ${OUT_TYPE_LABELS[outType]}`
                    : null}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <InPlayWizardContent
            step={step}
            outType={outType}
            onSelect={onSelect}
            onStepChange={onStepChange}
            onOutTypeChange={onOutTypeChange}
            paResultOutsRecorded={paResultOutsRecorded}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

interface InPlayWizardContentProps {
  step: InPlayStep;
  outType: InPlayOutType | null;
  onSelect: (result: PAResultType) => void;
  onStepChange: (step: InPlayStep) => void;
  onOutTypeChange: (type: InPlayOutType | null) => void;
  paResultOutsRecorded: (result: PAResultType) => number;
}

const InPlayWizardContent = ({
  step,
  outType,
  onSelect,
  onStepChange,
  onOutTypeChange,
  paResultOutsRecorded,
}: InPlayWizardContentProps) => {
  if (step === "hit_or_out") {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onStepChange("hit_type")}
          className={WIZARD_BTN}
        >
          Hit
        </button>
        <button
          type="button"
          onClick={() => onStepChange("out_type")}
          className={WIZARD_BTN}
        >
          Out
        </button>
      </div>
    );
  }

  if (step === "hit_type") {
    return (
      <div className="flex flex-wrap gap-2">
        {HIT_OPTIONS.map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onSelect(result)}
            className={WIZARD_BTN}
          >
            {HIT_LABELS[result]}
          </button>
        ))}
      </div>
    );
  }

  if (step === "out_type") {
    return (
      <div className="flex flex-wrap gap-2">
        {OUT_TYPE_CHOICES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              onOutTypeChange(type);
              onStepChange("out_scoring");
            }}
            className={WIZARD_BTN}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (step === "out_scoring" && outType) {
    return (
      <div className="flex flex-wrap gap-2">
        {OUT_TYPE_TO_OPTIONS[outType].map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onSelect(result)}
            className={WIZARD_BTN}
          >
            <span>{result}</span>
            {paResultOutsRecorded(result) > 0 ? (
              <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                {paResultOutsRecorded(result)} out
              </span>
            ) : null}
          </button>
        ))}
      </div>
    );
  }

  return null;
};
