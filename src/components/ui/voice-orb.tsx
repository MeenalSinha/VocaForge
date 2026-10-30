"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AgentVoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "completed"
  | "error";

interface VoiceOrbProps {
  state?: AgentVoiceState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  volume?: number; // 0 to 1
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-20 h-20",
  lg: "w-32 h-32",
  xl: "w-44 h-44",
};

/**
 * VoiceOrb — An ElevenLabs-inspired reactive audio visualizer.
 * Reflects genuine conversational states (idle, connecting, listening, thinking, speaking).
 */
export function VoiceOrb({
  state = "idle",
  size = "md",
  className,
  volume = 0.5,
}: VoiceOrbProps) {
  return (
    <div className={cn("relative flex items-center justify-center select-none", sizeClasses[size], className)}>
      {/* Outer Glow Halo */}
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-xl transition-all duration-700 ease-out",
          state === "idle" && "bg-neutral-300/30 opacity-40 scale-95",
          state === "connecting" && "bg-amber-400/40 opacity-70 animate-pulse scale-105",
          state === "listening" && "bg-violet-400/50 opacity-80 animate-pulse scale-110",
          state === "thinking" && "bg-sky-400/50 opacity-80 scale-105 animate-spin duration-3000",
          state === "speaking" && "bg-gradient-to-tr from-violet-600/60 to-purple-400/60 opacity-90 scale-125",
          state === "completed" && "bg-emerald-400/40 opacity-60 scale-100",
          state === "error" && "bg-rose-500/50 opacity-80 scale-100",
        )}
      />

      {/* Primary Spherical Gradient Orb */}
      <div
        className={cn(
          "relative w-full h-full rounded-full transition-all duration-500 shadow-lg flex items-center justify-center overflow-hidden",
          state === "idle" && "bg-gradient-to-b from-neutral-100 via-neutral-200 to-neutral-300 shadow-neutral-200/50",
          state === "connecting" && "bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 shadow-amber-300/40",
          state === "listening" && "bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-400 shadow-purple-500/40 animate-pulse-subtle",
          state === "thinking" && "bg-gradient-to-tr from-indigo-500 via-sky-400 to-teal-300 shadow-indigo-500/40",
          state === "speaking" && "bg-gradient-to-tr from-violet-700 via-purple-600 to-fuchsia-500 shadow-purple-600/50",
          state === "completed" && "bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-300 shadow-emerald-500/40",
          state === "error" && "bg-gradient-to-tr from-rose-600 via-red-500 to-orange-400 shadow-rose-500/40",
        )}
      >
        {/* Internal Specular Highlight & Glass Rim */}
        <div className="absolute top-1 left-2 right-2 h-1/3 rounded-full bg-gradient-to-b from-white/70 to-transparent blur-[1px] pointer-events-none" />

        {/* Dynamic Waveform Rings when Speaking or Listening */}
        {(state === "speaking" || state === "listening") && (
          <div className="flex items-center gap-1 z-10">
            <span
              className="w-1 bg-white/90 rounded-full animate-wave-bar"
              style={{ animationDuration: "0.8s", height: `${Math.max(20, volume * 100)}%` }}
            />
            <span
              className="w-1 bg-white/90 rounded-full animate-wave-bar"
              style={{ animationDuration: "1.1s", animationDelay: "0.15s", height: `${Math.max(30, volume * 120)}%` }}
            />
            <span
              className="w-1 bg-white/90 rounded-full animate-wave-bar"
              style={{ animationDuration: "0.9s", animationDelay: "0.3s", height: `${Math.max(20, volume * 90)}%` }}
            />
          </div>
        )}

        {state === "thinking" && (
          <div className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
        )}
      </div>
    </div>
  );
}

/**
 * LiveWaveform — Real-time audio waveform visualizer for playback or speaking state.
 */
export function LiveWaveform({
  active = false,
  barCount = 18,
  className,
}: {
  active?: boolean;
  barCount?: number;
  className?: string;
}) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className={cn("flex items-center gap-[2.5px] h-6 px-1 select-none", className)}>
      {bars.map((idx) => {
        // Vary heights organically
        const delay = (idx % 5) * 0.12;
        const duration = 0.6 + ((idx % 4) * 0.2);

        return (
          <span
            key={idx}
            className={cn(
              "w-[2px] rounded-full transition-all duration-300",
              active ? "bg-foreground animate-wave-bar" : "bg-neutral-300 h-1.5",
            )}
            style={
              active
                ? {
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                    height: "100%",
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

