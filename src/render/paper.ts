// 종이 텍스처와 체스판(먹 번짐 + 빗금) 굽기
import { BOARD, PAPER, S, inkA } from '../config';
import { fbm, noise2, rng, type Pt } from '../util/noise';
import { penLine } from './pieceArt';

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d');
  return [c, ctx];
}

/** 타일 가능한 종이 결 */
export function makePaper(size = 512): HTMLCanvasElement {
  const [c, ctx] = mk(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // 타일링: 주기적 좌표로 노이즈
      const u = x / size;
      const v = y / size;
      const lo = fbm(Math.cos(u * 6.283) * 1.4 + 9, Math.sin(v * 6.283) * 1.4 + Math.sin(u * 6.283), 4, 4);
      const fib = noise2(x * 0.9, y * 0.12, 11) * 0.5 + noise2(x * 0.12, y * 0.9, 12) * 0.5;
      const g = noise2(x * 1.3, y * 1.3, 13);
      const k = 1 + (lo - 0.5) * 0.05 + (fib - 0.5) * 0.035 + (g - 0.5) * 0.04;
      img.data[i] = PAPER[0] * k;
      img.data[i + 1] = PAPER[1] * k;
      img.data[i + 2] = PAPER[2] * k * 0.995;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 손으로 그린 사각형 테두리(약간 일그러진 다각형) */
function wobblyRect(x: number, y: number, w: number, h: number, amp: number, seed: number): Pt[] {
  const pts: Pt[] = [];
  const side = (ax: number, ay: number, bx: number, by: number, s: number): void => {
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const n = (noise2(t * 3, s, seed) - 0.5) * 2 * amp;
      const nx = -(by - ay);
      const ny = bx - ax;
      const l = Math.hypot(nx, ny);
      pts.push([ax + (bx - ax) * t + (nx / l) * n, ay + (by - ay) * t + (ny / l) * n]);
    }
  };
  side(x, y, x + w, y, 1);
  side(x + w, y, x + w, y + h, 2);
  side(x + w, y + h, x, y + h, 3);
  side(x, y + h, x, y, 4);
  return pts;
}

export const BOARD_MARGIN = 46;

/** 체스판 이미지 (월드 → px 배율 k) */
export function makeBoard(paper: HTMLCanvasElement, k: number, flipped = false): HTMLCanvasElement {
  const M = BOARD_MARGIN;
  const W = Math.round((BOARD + M * 2) * k);
  const [c, ctx] = mk(W, W);
  const pat = ctx.createPattern(paper, 'repeat');
  if (pat) ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, W);
  ctx.scale(k, k);
  ctx.translate(M, M);
  const r = rng(77);
  for (let f = 0; f < 8; f++) {
    for (let rk = 0; rk < 8; rk++) {
      if ((f + rk) % 2 === 0) continue;
      const seed = f * 8 + rk;
      const poly = wobblyRect(f * S + 1.5, rk * S + 1.5, S - 3, S - 3, 1.6, seed);
      const path = new Path2D();
      poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      // 옅은 먹 번짐 (얼룩덜룩)
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = inkA(0.08 + r() * 0.03);
      ctx.fill(path);
      for (let b = 0; b < 4; b++) {
        const gx = f * S + r() * S;
        const gy = rk * S + r() * S;
        const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, S * (0.3 + r() * 0.4));
        g.addColorStop(0, inkA(0.05));
        g.addColorStop(1, inkA(0));
        ctx.fillStyle = g;
        ctx.fillRect(f * S, rk * S, S, S);
      }
      // 빗금
      ctx.lineCap = 'round';
      for (let x = -S; x < S * 2; x += 6.2 + r() * 1.6) {
        ctx.strokeStyle = inkA(0.16 + r() * 0.12);
        ctx.lineWidth = 0.55 + r() * 0.5;
        ctx.beginPath();
        ctx.moveTo(f * S + x, rk * S + S + 2);
        ctx.lineTo(f * S + x + S + (r() - 0.5) * 4, rk * S - 2);
        ctx.stroke();
      }
      ctx.restore();
      // 가장자리 진해짐
      ctx.strokeStyle = inkA(0.1);
      ctx.lineWidth = 2.4;
      ctx.stroke(path);
    }
  }
  // 칸 경계 연필선
  for (let i = 1; i < 8; i++) {
    penLine(ctx, [[i * S, 0], [i * S, BOARD]], 0.6, 300 + i, false, { alpha: 0.18, breaks: 0.7, jitter: 0.5 });
    penLine(ctx, [[0, i * S], [BOARD, i * S]], 0.6, 400 + i, false, { alpha: 0.18, breaks: 0.7, jitter: 0.5 });
  }
  // 이중 테두리
  const frame = (o: number, w: number, s: number): void =>
    penLine(ctx, [[-o, -o], [BOARD + o, -o], [BOARD + o, BOARD + o], [-o, BOARD + o]], w, s, true, { breaks: 0.86, jitter: 0.8 });
  frame(2, 2.6, 1);
  frame(9, 1.1, 2);
  // 좌표 글씨
  ctx.fillStyle = inkA(0.72);
  ctx.font = '26px "Nanum Pen Script", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const files = 'abcdefgh';
  for (let i = 0; i < 8; i++) {
    ctx.fillText(files[flipped ? 7 - i : i], i * S + S / 2, BOARD + 28);
    ctx.fillText(String(flipped ? i + 1 : 8 - i), -27, i * S + S / 2);
  }
  return c;
}
