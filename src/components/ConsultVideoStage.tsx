"use client";

import type { RefObject } from "react";
import type { CallPhase } from "@/lib/consult-call";
import { overlayCopy } from "@/lib/consult-call";

type Props = {
  isDoctor: boolean;
  phase: CallPhase;
  hostLabel: string;
  otherName: string;
  localName: string;
  remoteName: string;
  localVideo: RefObject<HTMLVideoElement | null>;
  remoteVideo: RefObject<HTMLVideoElement | null>;
  hasRemote: boolean;
  quality: "good" | "fair" | "poor" | null;
};

export function ConsultVideoStage({
  isDoctor,
  phase,
  hostLabel,
  otherName,
  localName,
  remoteName,
  localVideo,
  remoteVideo,
  hasRemote,
  quality,
}: Props) {
  const overlay = hasRemote && phase === "connected" ? null : overlayCopy(phase, hostLabel, otherName);
  const qualityLabel = quality === "poor" ? "Sinal fraco" : quality === "fair" ? "Sinal instável" : quality === "good" ? "Sinal bom" : null;

  return (
    <div className={isDoctor ? "relative" : "grid gap-4 lg:grid-cols-2"}>
      <div
        className={`relative overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-[#0a0a0a] ${
          isDoctor ? "aspect-video" : "aspect-video border-[var(--border)] bg-black lg:order-2"
        }`}
      >
        <video
          ref={isDoctor ? remoteVideo : localVideo}
          autoPlay
          muted={!isDoctor}
          playsInline
          className="h-full w-full object-cover"
        />
        {isDoctor && overlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/72 px-6 text-center text-white">
            <p className="text-lg font-extrabold">{overlay.title}</p>
            <p className="mt-2 max-w-md text-sm text-white/80">{overlay.detail}</p>
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {isDoctor ? remoteName : localName}
        </span>
        {qualityLabel && (
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
            {qualityLabel}
          </span>
        )}
      </div>
      <div
        className={
          isDoctor
            ? "absolute bottom-3 right-3 z-10 aspect-video w-[38%] max-w-[220px] overflow-hidden rounded-2xl border border-white/30 bg-black shadow-lg"
            : "relative aspect-video overflow-hidden rounded-[24px] border border-[var(--border-gold)] bg-[#0a0a0a]"
        }
      >
        <video
          ref={isDoctor ? localVideo : remoteVideo}
          autoPlay
          muted={isDoctor}
          playsInline
          className="h-full w-full object-cover"
        />
        {!isDoctor && overlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/72 px-4 text-center text-white">
            <p className="text-base font-extrabold">{overlay.title}</p>
            <p className="mt-2 text-xs text-white/80">{overlay.detail}</p>
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          {isDoctor ? localName : remoteName}
        </span>
      </div>
    </div>
  );
}
