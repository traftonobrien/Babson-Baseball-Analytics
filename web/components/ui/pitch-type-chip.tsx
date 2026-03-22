import type { CSSProperties } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import { cn } from "@/lib/utils";

type PitchTypeChipSize = "sm" | "xs";
/** soft = light surface (default); solid = dark glass on zinc panels */
type PitchTypeChipVariant = "solid" | "soft";

function hexToRgbChannels(value: string): string {
  const normalized = value.trim();
  const fullHex =
    normalized.startsWith("#") && normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;

  const match = /^#([0-9a-f]{6})$/i.exec(fullHex);
  if (!match) return "113, 113, 122";

  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function pitchTypeChipStyle(pitchType: string, variant: PitchTypeChipVariant): CSSProperties {
  const color = pitchColor(pitchType);
  const rgb = hexToRgbChannels(color);

  if (variant === "soft") {
    return {
      borderColor: `rgba(${rgb}, 0.28)`,
      backgroundColor: `rgba(${rgb}, 0.1)`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
    };
  }

  return {
    borderColor: `rgba(${rgb}, 0.42)`,
    background: `linear-gradient(135deg, rgba(${rgb}, 0.24), rgba(9, 9, 11, 0.92))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(${rgb}, 0.1), 0 0 18px rgba(${rgb}, 0.14)`,
  };
}

const chipSizeClasses: Record<PitchTypeChipSize, string> = {
  sm: "gap-2 px-3 py-1.5 text-xs font-semibold",
  xs: "gap-1.5 px-2.5 py-1 text-[11px] font-semibold",
};

const dotSizeClasses: Record<PitchTypeChipSize, string> = {
  sm: "h-2 w-2",
  xs: "h-1.5 w-1.5",
};

export function PitchTypeChip({
  pitchType,
  label,
  size = "sm",
  variant = "soft",
  className,
}: {
  pitchType: string;
  label?: string;
  size?: PitchTypeChipSize;
  variant?: PitchTypeChipVariant;
  className?: string;
}) {
  const color = pitchColor(pitchType);
  const displayLabel = pitchDisplayName(label ?? pitchType);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border",
        variant === "solid" ? "text-white" : "text-[#0f172a]",
        chipSizeClasses[size],
        className,
      )}
      style={pitchTypeChipStyle(pitchType, variant)}
    >
      <span
        className={cn("rounded-full shrink-0", dotSizeClasses[size])}
        style={{
          backgroundColor: color,
          boxShadow: variant === "soft" ? `0 0 0 1px rgba(255,255,255,0.6) inset` : `0 0 10px ${color}`,
        }}
      />
      {displayLabel}
    </span>
  );
}
