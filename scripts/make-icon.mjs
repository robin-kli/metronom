// Renders the app icon (build/icon.png, 512×512) without external tools:
// the dark surface with four beat blocks, beat 1 lit in the accent colour.
// Run: node scripts/make-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 512;
const SAMPLES = 4; // 4×4 supersampling for smooth edges

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const SURFACE = hex('#0E0F12');
const ACCENT = hex('#FFB020');
const BEAT_OFF = hex('#4A4F59');

/** Rounded rectangles, drawn in order (later ones on top). */
const BLOCK = 80;
const GAP = 16;
const left = (SIZE - (4 * BLOCK + 3 * GAP)) / 2;
const top = (SIZE - BLOCK) / 2;
const shapes = [
  { x: 32, y: 32, w: 448, h: 448, r: 96, color: SURFACE },
  ...[0, 1, 2, 3].map((i) => ({
    x: left + i * (BLOCK + GAP),
    y: top,
    w: BLOCK,
    h: BLOCK,
    r: 14,
    color: i === 0 ? ACCENT : BEAT_OFF,
  })),
];

function inside({ x, y, w, h, r }, px, py) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

const rows = [];
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(1 + SIZE * 4); // filter byte 0 + RGBA
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const px = x + (sx + 0.5) / SAMPLES;
        const py = y + (sy + 0.5) / SAMPLES;
        let hit = null;
        for (const s of shapes) if (inside(s, px, py)) hit = s.color;
        if (hit) {
          r += hit[0];
          g += hit[1];
          b += hit[2];
          a += 1;
        }
      }
    }
    const o = 1 + x * 4;
    if (a > 0) {
      row[o] = Math.round(r / a);
      row[o + 1] = Math.round(g / a);
      row[o + 2] = Math.round(b / a);
    }
    row[o + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
  }
  rows.push(row);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('build', { recursive: true });
writeFileSync('build/icon.png', png);
console.log(`build/icon.png written (${png.length} bytes)`);
