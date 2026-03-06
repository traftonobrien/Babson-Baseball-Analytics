"use client";

import { memo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { animate } from "motion/react";
import { cn } from "@/lib/utils";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}

type MoveSubscriber = (event?: PointerEvent) => void;

const moveSubscribers = new Set<MoveSubscriber>();
let removeGlobalListeners: (() => void) | null = null;

function notifySubscribers(event?: PointerEvent) {
  moveSubscribers.forEach((subscriber) => subscriber(event));
}

function ensureGlobalListeners() {
  if (removeGlobalListeners || typeof window === "undefined") return;

  const handleScroll = () => notifySubscribers();
  const handlePointerMove = (event: PointerEvent) => notifySubscribers(event);

  window.addEventListener("scroll", handleScroll, { passive: true });
  document.body.addEventListener("pointermove", handlePointerMove, {
    passive: true,
  });

  removeGlobalListeners = () => {
    window.removeEventListener("scroll", handleScroll);
    document.body.removeEventListener("pointermove", handlePointerMove);
    removeGlobalListeners = null;
  };
}

function subscribeToMovement(subscriber: MoveSubscriber) {
  moveSubscribers.add(subscriber);
  ensureGlobalListeners();

  return () => {
    moveSubscribers.delete(subscriber);
    if (moveSubscribers.size === 0) {
      removeGlobalListeners?.();
    }
  };
}

const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | PointerEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;

          if (e) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "1" : "0");

          if (!isActive) return;

          const currentAngle =
            Number.parseFloat(element.style.getPropertyValue("--start")) || 0;
          const targetAngle =
            (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => {
              element.style.setProperty("--start", String(value));
            },
          });
        });
      },
      [inactiveZone, movementDuration, proximity],
    );

    useEffect(() => {
      if (disabled) return;
      const unsubscribe = subscribeToMovement(handleMove);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        unsubscribe();
      };
    }, [disabled, handleMove]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100",
            variant === "white" && "border-white/30",
            disabled && "!block",
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      rgba(255,255,255,0.9) 0%,
                      rgba(255,255,255,0.15) calc(25% / var(--repeating-conic-gradient-times)),
                      rgba(255,255,255,0.9) calc(50% / var(--repeating-conic-gradient-times)),
                      rgba(255,255,255,0.15) calc(75% / var(--repeating-conic-gradient-times)),
                      rgba(255,255,255,0.9) calc(100% / var(--repeating-conic-gradient-times))
                    )`
                  : `radial-gradient(circle, rgba(var(--babson-green-rgb), 0.88) 10%, rgba(var(--babson-green-rgb), 0) 22%),
                    radial-gradient(circle at 40% 40%, rgba(var(--babson-grey-rgb), 0.72) 6%, rgba(var(--babson-grey-rgb), 0) 18%),
                    radial-gradient(circle at 64% 62%, rgba(255, 255, 255, 0.16) 8%, rgba(255, 255, 255, 0) 22%),
                    radial-gradient(circle at 38% 68%, rgba(var(--babson-green-rgb), 0.42) 10%, rgba(var(--babson-green-rgb), 0) 21%),
                    repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      rgba(var(--babson-green-rgb), 0.92) 0%,
                      rgba(var(--babson-grey-rgb), 0.84) calc(25% / var(--repeating-conic-gradient-times)),
                      rgba(255, 255, 255, 0.18) calc(50% / var(--repeating-conic-gradient-times)),
                      rgba(var(--babson-grey-rgb), 0.7) calc(75% / var(--repeating-conic-gradient-times)),
                      rgba(var(--babson-green-rgb), 0.92) calc(100% / var(--repeating-conic-gradient-times))
                    )`,
            } as CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            glow && "opacity-100",
            blur > 0 && "blur-[var(--blur)]",
            className,
            disabled && "!hidden",
          )}
        >
          <div
            className={cn(
              "glow rounded-[inherit]",
              'after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))] after:rounded-[inherit] after:content-[""]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
            )}
          />
        </div>
      </>
    );
  },
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
