import React from "react";
import { VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

type NeonButtonTone = "blue" | "orange" | "amber" | "zinc";

const buttonVariants = cva(
  "relative group border text-foreground text-center rounded-full transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-out will-change-transform active:scale-[0.985]",
  {
    variants: {
      variant: {
        default:
          "border-blue-400/30 bg-blue-500/[0.08] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(59,130,246,0.08)] hover:border-blue-300/45 hover:bg-blue-500/[0.12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(96,165,250,0.14),0_0_18px_rgba(59,130,246,0.10)]",
        solid:
          "bg-blue-500 hover:bg-blue-600 text-white border-transparent hover:border-foreground/50 transition-all duration-200",
        ghost:
          "border-transparent bg-transparent hover:border-zinc-600 hover:bg-white/10",
      },
      size: {
        default: "px-7 py-1.5",
        sm: "px-4 py-0.5",
        lg: "px-10 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const leaderboardFilterButtonBaseClassName =
  "mx-0 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-semibold";
const leaderboardFilterButtonBlueActiveClassName =
  "border-sky-200/70 bg-sky-300/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(186,230,253,0.22),0_0_20px_rgba(56,189,248,0.14)]";
const leaderboardFilterButtonOrangeActiveClassName =
  "border-orange-400/45 bg-orange-500/16 text-orange-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(251,146,60,0.16),0_0_20px_rgba(249,115,22,0.12)]";
const leaderboardFilterButtonAmberActiveClassName =
  "border-amber-400/45 bg-amber-500/16 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(252,211,77,0.16),0_0_20px_rgba(245,158,11,0.12)]";
const leaderboardFilterButtonZincActiveClassName =
  "border-zinc-600 bg-zinc-800/80 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const leaderboardFilterButtonBlueInactiveClassName = "text-zinc-200";
const leaderboardFilterButtonGhostInactiveClassName =
  "border-transparent bg-transparent text-zinc-400 shadow-none hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100 hover:shadow-none";

const toneGlowClasses: Record<NeonButtonTone, string> = {
  blue: "via-blue-600 dark:via-blue-500",
  orange: "via-orange-500 dark:via-orange-400",
  amber: "via-amber-500 dark:via-amber-400",
  zinc: "via-zinc-400 dark:via-zinc-300",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  neon?: boolean;
  tone?: NeonButtonTone;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, neon = true, size, variant, tone = "blue", children, ...props },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "absolute inset-x-0 inset-y-0 mx-auto hidden h-px w-3/4 bg-gradient-to-r from-transparent to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-100",
            toneGlowClasses[tone],
            neon && "block",
          )}
        />
        {children}
        <span
          className={cn(
            "absolute inset-x-0 -bottom-px mx-auto hidden h-px w-3/4 bg-gradient-to-r from-transparent to-transparent transition-all duration-500 ease-in-out group-hover:opacity-30",
            toneGlowClasses[tone],
            neon && "block",
          )}
        />
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export {
  leaderboardFilterButtonAmberActiveClassName,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonBlueActiveClassName,
  leaderboardFilterButtonBlueInactiveClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonOrangeActiveClassName,
  leaderboardFilterButtonZincActiveClassName,
};
