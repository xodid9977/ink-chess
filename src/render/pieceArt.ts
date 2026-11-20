// 말을 '펜과 먹'으로 그린 이미지로 굽기: 종이 바탕 → 먹 번짐(wash) → 빗금 → 펜 외곽선, 보일링 3프레임
import { ART, INK, PAPER, inkA } from '../config';
import { clamp, fbm, noise1, noise2, resample, rng, smooth, type Pt } from '../util/noise';
import { GEOM, type Color, type PieceGeom, type PieceType } from './shapes';

export interface PieceArt {
  frames: HTMLCanvasElement[];
  w: number;
  h: number;
  ox: number;
  oy: number;
  R: number;
  geom: PieceGeom;
  path: Path2D; // 월드 단위(1칸=100) 실루엣, 원점=받침 중앙
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d');
  return [c, ctx];
}

/** 펜 선: 굵기가 변하고 가끔 끊기며 끝이 가늘어지는 획 */
export function penLine(
  ctx: CanvasRenderingContext2D, pts: Pt[], baseW: number, seed: number, closed: boolean,
  opts: { breaks?: number; jitter?: number; alpha?: number } = {},
): void {
  const step = Math.max(2, baseW * 1.6);
  const rp = resample(pts, step, closed);
  const r = rng(seed);
  const jit = opts.jitter ?? baseW * 0.35;
  const j: Pt[] = rp.map(([x, y], i) => [
    x + (noise1(i * 0.21, seed) - 0.5) * 2 * jit,
    y + (noise1(i * 0.21, seed + 9) - 0.5) * 2 * jit,
  ]);
  const n = j.length;
  ctx.lineCap = 'round';
  ctx.strokeStyle = inkA(opts.alpha ?? 0.92);
  const brk = opts.breaks ?? 0.8;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) {
    if (noise1(i * 0.09, seed + 50) > brk) continue;
    const a = j[i];
    const b = j[(i + 1) % n];
    const t = closed ? 1 : Math.min(1, Math.min(i, n - 1 - i) / 6 + 0.25);
    ctx.lineWidth = baseW * (0.5 + 1.05 * noise1(i * 0.13, seed + 3)) * t * (0.9 + r() * 0.2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

function hatch(ctx: CanvasRenderingContext2D, w: number, h: number, sp: number, lw: number, seed: number, dirSign: 1 | -1, a: number): void {
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let k = -h; k < w + h; k += sp * (0.8 + r() * 0.4)) {
    const x0 = k + (r() - 0.5) * sp * 0.4;
    ctx.strokeStyle = inkA(a * (0.6 + r() * 0.4));
    ctx.lineWidth = lw * (0.6 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x0, h + 2);
    ctx.lineTo(x0 + dirSign * h * 1.0 + (r() - 0.5) * sp, -2);
    ctx.stroke();
  }
}

function buildArt(type: PieceType, color: Color): PieceArt {
  const R = ART.R;
  const geom = GEOM[type];
  const w = Math.round(0.8 * R);
  const h = Math.round(1.1 * R);
  const ox = w / 2;
  const oy = h - 0.04 * R;
  const toPx = ([x, y]: Pt): Pt => [ox + x * R, oy - y * R];
  const silPath = new Path2D();
  const world = new Path2D();
  for (const poly of geom.polys) {
    poly.forEach((p, i) => {
      const [x, y] = toPx(p);
      if (i === 0) silPath.moveTo(x, y); else silPath.lineTo(x, y);
      if (i === 0) world.moveTo(p[0] * 100, -p[1] * 100); else world.lineTo(p[0] * 100, -p[1] * 100);
    });
    silPath.closePath();
    world.closePath();
  }

  // 1) 실루엣 알파 + 블러(가장자리 진해짐 계산용)
  const [sil, sctx] = mk(w, h);
  sctx.fill(silPath);
  const silD = sctx.getImageData(0, 0, w, h).data;
  const [, bctx] = mk(w, h);
  bctx.filter = `blur(${Math.round(R * 0.014)}px)`;
  bctx.drawImage(sil, 0, 0);
  const blD = bctx.getImageData(0, 0, w, h).data;

  // 2) 행마다 중심/반폭 → 원통 음영(nx: -1 왼쪽 빛 ~ +1 오른쪽 그림자)
  const mid = new Float32Array(h);
  const half = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let l = -1;
    let rr = -1;
    for (let x = 0; x < w; x++) {
      if (silD[(y * w + x) * 4 + 3] > 120) { if (l < 0) l = x; rr = x; }
    }
    mid[y] = l < 0 ? w / 2 : (l + rr) / 2;
    half[y] = l < 0 ? 1 : Math.max(1, (rr - l) / 2);
  }

  // 3) 먹 번짐(wash) 픽셀 계산 + 빗금 마스크
  const [wash, wctx] = mk(w, h);
  const [m1, m1ctx] = mk(w, h);
  const [m2, m2ctx] = mk(w, h);
  const wi = wctx.createImageData(w, h);
  const mi1 = m1ctx.createImageData(w, h);
  const mi2 = m2ctx.createImageData(w, h);
  const black = color === 'b';
  const sd = black ? 2 : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = silD[i + 3];
      if (a === 0) continue;
      const nx = (x - mid[y]) / half[y];
      const n1 = fbm(x / (R * 0.16), y / (R * 0.16), sd, 3);
      const g = noise2(x / 1.7, y / 1.7, 7);
      const edge = clamp((1 - blD[i + 3] / 255) * 2.4);
      const bottom = smooth(oy - 0.14 * R, oy, y);
      let d: number;
      let h1: number;
      let h2: number;
      if (black) {
        const hl = smooth(-0.95, -0.62, nx) * (1 - smooth(-0.42, -0.12, nx));
        d = 0.74 + 0.22 * (n1 - 0.5) + 0.14 * smooth(0, 1, nx) + edge * 0.22 - hl * 0.5 + (g - 0.5) * 0.09;
        h1 = smooth(-0.1, 0.6, nx) * 0.9;
        h2 = smooth(0.4, 0.95, nx) * 0.8;
      } else {
        d = 0.03 + 0.26 * smooth(-0.05, 1.05, nx) + 0.1 * (n1 - 0.5) + edge * 0.16 + bottom * 0.08 + (g - 0.5) * 0.05;
        h1 = smooth(0.05, 0.75, nx);
        h2 = smooth(0.5, 1.0, nx) * 0.85;
      }
      d = clamp(d, 0, 0.96);
      wi.data[i] = PAPER[0] * (1 - d) + INK[0] * d;
      wi.data[i + 1] = PAPER[1] * (1 - d) + INK[1] * d;
      wi.data[i + 2] = PAPER[2] * (1 - d) + INK[2] * d;
      wi.data[i + 3] = a;
      mi1.data[i + 3] = a * h1;
      mi2.data[i + 3] = a * h2;
    }
  }
  wctx.putImageData(wi, 0, 0);
  m1ctx.putImageData(mi1, 0, 0);
  m2ctx.putImageData(mi2, 0, 0);

  // 4) 보일링 프레임마다 빗금·외곽선을 조금씩 다르게
  const frames: HTMLCanvasElement[] = [];
  const lw = R * 0.0115;
  for (let f = 0; f < ART.boilFrames; f++) {
    const seed = f * 101 + (black ? 7 : 3) + type.charCodeAt(0);
    const [c, ctx] = mk(w, h);
    ctx.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
    ctx.fill(silPath);
    // 먹이 선에서 살짝 어긋남(misregistration)
    ctx.drawImage(wash, -R * 0.005 + f * 0.6, R * 0.004);
    const [hc, hctx] = mk(w, h);
    hatch(hctx, w, h, R * 0.021, R * 0.0034, seed, 1, black ? 0.75 : 0.62);
    hctx.globalCompositeOperation = 'destination-in';
    hctx.drawImage(m1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(hc, 0, 0);
    const [hc2, h2ctx] = mk(w, h);
    hatch(h2ctx, w, h, R * 0.026, R * 0.003, seed + 1, -1, black ? 0.7 : 0.55);
    h2ctx.globalCompositeOperation = 'destination-in';
    h2ctx.drawImage(m2, 0, 0);
    ctx.drawImage(hc2, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    for (const poly of geom.polys) {
      const px = poly.map(toPx);
      penLine(ctx, px, lw, seed + 11, true, { breaks: 0.82 });
      penLine(ctx, px, lw * 0.45, seed + 23, true, { breaks: 0.55, alpha: 0.4, jitter: lw * 0.9 });
    }
    for (const d of geom.details) {
      const px = d.pts.map(toPx);
      if (d.fill) {
        ctx.fillStyle = inkA(0.95);
        ctx.beginPath();
        px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.fill();
      } else {
        const col = black && d.w < 0.01 ? 0.5 : 0.9;
        penLine(ctx, px, d.w * R, seed + 31, false, { breaks: 0.9, alpha: col });
      }
    }
    frames.push(c);
  }
  return { frames, w, h, ox, oy, R, geom, path: world };
}

const cache = new Map<string, PieceArt>();
export function getArt(type: PieceType, color: Color): PieceArt {
  const k = type + color;
  let a = cache.get(k);
  if (!a) {
    a = buildArt(type, color);
    cache.set(k, a);
  }
  return a;
}

export async function preloadArt(onStep: (i: number, n: number) => void): Promise<void> {
  const types: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];
  const all: [PieceType, Color][] = [];
  for (const t of types) for (const c of ['w', 'b'] as Color[]) all.push([t, c]);
  for (let i = 0; i < all.length; i++) {
    getArt(all[i][0], all[i][1]);
    onStep(i + 1, all.length);
    await new Promise((r) => setTimeout(r, 0));
  }
}
