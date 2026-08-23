"use client";

import { useMemo } from "react";

type Props = { className?: string };

/** Marca pequena do rim (usada em badges, cabeçalhos e brand lockups). */
export function KidneyMark({ className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="km-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--gold-dark)" />
        </linearGradient>
      </defs>
      <path d="M25 8c-9 0-15 8-15 18 0 12 7 22 15 22 5 0 8-4 8-9V17c0-6-3-9-8-9Z" fill="url(#km-g)" />
      <path d="M39 8c9 0 15 8 15 18 0 12-7 22-15 22-5 0-8-4-8-9V17c0-6 3-9 8-9Z" fill="url(#km-g)" opacity="0.88" />
      <circle cx="22" cy="20" r="2.4" fill="#fff" opacity="0.9" />
      <circle cx="42" cy="20" r="2.4" fill="#fff" opacity="0.9" />
    </svg>
  );
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIDNEY_PATH =
  "M250 60 C 330 60 372 130 372 210 C 372 300 320 366 248 356 C 214 351 196 322 205 288 C 214 256 250 250 250 210 C 250 170 214 164 205 132 C 197 100 214 60 250 60 Z";

/** Ilustração premium do rim com "plexo neural" denso — nós + conexões luminosas,
 * gerados de forma determinística e recortados no contorno do rim. */
export function KidneyPlexus({ className }: Props) {
  const { nodes, edges, pulses } = useMemo(() => {
    const rnd = mulberry32(20260823);
    const cx = 252;
    const cy = 210;
    const pts: { x: number; y: number }[] = [];
    let tries = 0;
    while (pts.length < 32 && tries < 1400) {
      tries++;
      const theta = ((rnd() * 2 - 1) * 108 * Math.PI) / 180;
      const rho = 30 + rnd() * 92;
      const x = cx + Math.cos(theta) * rho;
      const y = cy + Math.sin(theta) * rho;
      if (pts.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > 21 * 21)) pts.push({ x, y });
    }
    const edges: { a: number; b: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 60) edges.push({ a: i, b: j });
      }
    }
    // Alguns nós "pulsam" para dar vida.
    const pulses = pts.map((_, i) => i).filter((i) => i % 4 === 0);
    return { nodes: pts, edges, pulses };
  }, []);

  return (
    <svg viewBox="0 0 500 440" className={className} fill="none" aria-hidden="true" role="img">
      <defs>
        <radialGradient id="kp-halo" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#13b3bc" stopOpacity="0.4" />
          <stop offset="55%" stopColor="#087b82" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#087b82" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kp-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0fa3ac" />
          <stop offset="55%" stopColor="#087b82" />
          <stop offset="100%" stopColor="#04434a" />
        </linearGradient>
        <linearGradient id="kp-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="kp-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="kp-clip">
          <path d={KIDNEY_PATH} />
        </clipPath>
      </defs>

      {/* Halo e anéis */}
      <circle cx="250" cy="205" r="200" fill="url(#kp-halo)" />
      <circle cx="252" cy="210" r="158" stroke="#13b3bc" strokeOpacity="0.14" strokeWidth="1.5" fill="none" />
      <circle cx="252" cy="210" r="124" stroke="#13b3bc" strokeOpacity="0.1" strokeWidth="1.5" fill="none" />

      {/* Vasos entrando pela chanfradura */}
      <g stroke="#0fa3ac" strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M205 206 C 168 206 138 198 112 208" strokeOpacity="0.9" />
        <path d="M212 244 C 178 250 146 262 120 256" strokeOpacity="0.55" />
      </g>

      {/* Corpo do rim */}
      <path d={KIDNEY_PATH} fill="url(#kp-body)" />
      <path d="M250 74 C 316 74 356 122 368 182 C 314 142 256 150 246 126 C 240 112 240 88 250 74 Z" fill="url(#kp-gloss)" />

      {/* Plexo neural (recortado no contorno do rim) */}
      <g clipPath="url(#kp-clip)">
        <g stroke="#dffafb" strokeWidth="1.1" strokeOpacity="0.55">
          {edges.map((e, i) => (
            <line key={i} x1={nodes[e.a].x} y1={nodes[e.a].y} x2={nodes[e.b].x} y2={nodes[e.b].y} />
          ))}
        </g>
        <g fill="#ffffff" filter="url(#kp-glow)">
          {nodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={pulses.includes(i) ? 3 : 2}
              opacity={pulses.includes(i) ? 1 : 0.7}
              style={pulses.includes(i) ? { animation: `node-pulse ${2.4 + (i % 5) * 0.35}s ease-in-out ${(i % 7) * 0.2}s infinite` } : undefined}
            />
          ))}
        </g>
      </g>

      {/* Partículas orbitais externas */}
      <g fill="#13b3bc">
        <circle cx="96" cy="120" r="4" className="animate-soft-pulse" />
        <circle cx="392" cy="96" r="3" className="animate-soft-pulse" />
        <circle cx="120" cy="330" r="3.5" className="animate-soft-pulse" />
        <circle cx="410" cy="300" r="3" className="animate-soft-pulse" />
      </g>
    </svg>
  );
}
