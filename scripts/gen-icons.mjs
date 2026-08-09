// Gera os ícones do PWA a partir da marca atual (quadrado petróleo + dois rins brancos).
// Uso: node scripts/gen-icons.mjs  (sharp é devDependency; não roda em produção)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const TEAL = "#087b82";
const TEAL_DARK = "#075e70";

// Marca (viewBox 24) reaproveitada do BrandMark do header.
const kidneys = `
  <path d="M9 3C5.7 3 4 6 4 9.5 4 13.6 6.4 16.5 9 16.5c1.7 0 2.6-1.2 2.6-3V8C11.6 5 10.8 3 9 3Z" fill="#fff" opacity="0.97"/>
  <path d="M15 3c3.3 0 5 3 5 6.5 0 4.1-2.4 7-5 7-1.7 0-2.6-1.2-2.6-3V8C12.4 5 13.2 3 15 3Z" fill="#fff" opacity="0.97"/>
`;

function svg({ size = 512, radiusRatio = 0.22, markScale = 0.5, maskable = false }) {
  const r = Math.round(size * radiusRatio);
  // Escala/centraliza a marca (24x24) no ícone. Maskable usa marca menor (safe zone).
  const scale = (size * markScale) / 24;
  const tx = (size - 24 * scale) / 2;
  const ty = (size - 24 * scale) / 2;
  const bg = maskable
    ? `<rect width="${size}" height="${size}" fill="${TEAL}"/>`
    : `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${TEAL}"/><stop offset="1" stop-color="${TEAL_DARK}"/>
  </linearGradient></defs>
  ${bg}
  <g transform="translate(${tx} ${ty}) scale(${scale})">${kidneys}</g>
</svg>`;
}

const OUT = "public/icons";
await mkdir(OUT, { recursive: true });

const jobs = [
  { name: "icon-192.png", size: 192, opts: {} },
  { name: "icon-512.png", size: 512, opts: {} },
  { name: "icon-maskable-192.png", size: 192, opts: { maskable: true, markScale: 0.42 } },
  { name: "icon-maskable-512.png", size: 512, opts: { maskable: true, markScale: 0.42 } },
  { name: "apple-touch-icon.png", size: 180, opts: { radiusRatio: 0 } }, // iOS aplica cantos
  { name: "favicon-32.png", size: 32, opts: { radiusRatio: 0.18, markScale: 0.62 } },
];

for (const j of jobs) {
  const s = svg({ size: j.size, ...j.opts });
  await sharp(Buffer.from(s)).png().toFile(`${OUT}/${j.name}`);
  console.log("gerado:", `${OUT}/${j.name}`);
}
console.log("OK");
