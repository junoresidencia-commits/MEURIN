"use client";

import type { RefObject } from "react";
import type { CallPhase, NetQuality } from "@/lib/consult-call";
import { overlayCopy, qualityIndicator } from "@/lib/consult-call";

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
  quality: NetQuality | null;
  notice?: { tone: "info" | "warn"; text: string } | null;
  audioOnly?: boolean;
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
  notice,
  audioOnly = false,
}: Props) {
  const overlay = hasRemote && phase === "connected" ? null : overlayCopy(phase, hostLabel, otherName);
  const badge = qualityIndicator(quality);

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
        {isDoctor && !overlay && audioOnly && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center text-white">
            <p className="max-w-sm text-sm font-semibold">Áudio da consulta ativo. O vídeo volta quando a internet melhorar.</p>
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {isDoctor ? remoteName : localName}
        </span>
        {badge && (
          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
            {badge.emoji} {badge.label}
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
        {!isDoctor && !overlay && audioOnly && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-white">
            <p className="text-xs font-semibold">Consulta em áudio. O vídeo volta sozinho.</p>
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          {isDoctor ? localName : remoteName}
        </span>
        {!isDoctor && badge && (
          <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
            {badge.emoji} {badge.label}
          </span>
        )}
      </div>
      {notice && (
        <p
          className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold ${
            isDoctor ? "" : "lg:col-span-2"
          } ${
            notice.tone === "warn"
              ? "border border-amber-300 bg-amber-50 text-amber-950"
              : "border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)]"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
