// '보이지 않는 깃펜'이 실시간으로 긋는 획, 충격파 고리, 소용돌이
import { inkA, paperA } from '../config';
import { applyPieceTf, type Anchor, type PieceEnt } from '../render/entity';
import { noise1, noise2, type Pt } from '../util/noise';

export type Taper = 'in' | 'out' | 'spindle' | 'flat';

export interface Stroke {
  pts: Pt[];
  parent?: PieceEnt | Anchor;
  w: number;
  taper: Taper;
  progress: number;
  alpha: number;
  seed: number;
  quill: boolean;
  dry: number; // 0~1 마른 붓(빈틈)
  paper: boolean; // 종이색(베인 틈)
  boil: boolean;
}

export interface Ring { x: number; y: number; r: number; w: number; alpha: number; seed: number; squash: number; spin: number; kind: 'ring' | 'spiral' }

const isPiece = (p: PieceEnt | Anchor): p is PieceEnt => 'type' in p;

function taperAt(t: Taper, u: number): number {
  switch (t) {
    case 'in': return 0.25 + 0.75 * u;
    case 'out': return 1 - 0.8 * u;
    case 'spindle': return Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 0.9 + 0.1;
    default: return 1;
  }
}

export class Strokes {
  list: Stroke[] = [];
  rings: Ring[] = [];

  add(o: Partial<Stroke> & { pts: Pt[] }): Stroke {
    const s: Stroke = {
      w: 4, taper: 'spindle', progress: 0, alpha: 1, seed: Math.random() * 999, quill: false, dry: 0,
      paper: false, boil: true, ...o,
    };
    this.list.push(s);
    return s;
  }

  ring(o: Partial<Ring> & { x: number; y: number }): Ring {
    const r: Ring = { r: 0, w: 5, alpha: 1, seed: Math.random() * 99, squash: 0.45, spin: 0, kind: 'ring', ...o };
    this.rings.push(r);
    return r;
  }

  prune(): void {
    this.list = this.list.filter((s) => s.alpha > 0.01 || s.progress < 1);
    this.rings = this.rings.filter((r) => r.alpha > 0.01);
  }

  clear(): void {
    this.list = [];
    this.rings = [];
  }

  draw(ctx: CanvasRenderingContext2D, boil: number): void {
    for (const s of this.list) this.drawStroke(ctx, s, boil);
    for (const r of this.rings) this.drawRing(ctx, r, boil);
  }

  private drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, boil: number): void {
    if (s.progress <= 0 || s.alpha <= 0.01 || s.pts.length < 2) return;
    if (s.parent && isPiece(s.parent) && !s.parent.visible) { s.alpha = 0; return; }
    ctx.save();
    if (s.parent) {
      if (isPiece(s.parent)) applyPieceTf(ctx, s.parent, false);
      else {
        ctx.translate(s.parent.x, s.parent.y);
        ctx.rotate(s.parent.rot);
      }
    }
    // 누적 길이
    const L: number[] = [0];
    for (let i = 1; i < s.pts.length; i++) L.push(L[i - 1] + Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]));
    const total = L[L.length - 1];
    const upto = total * Math.min(1, s.progress);
    const step = Math.max(1.2, Math.min(s.w * 0.5, 3));
    const bseed = s.boil ? boil * 13 : 0;
    // 경로를 촘촘히 샘플링 (위치, 진행률, 법선)
    const P: { p: Pt; u: number; d: number; nx: number; ny: number }[] = [];
    let seg = 0;
    for (let d = 0; d <= upto; d += step) {
      while (seg < L.length - 2 && L[seg + 1] < d) seg++;
      const a = s.pts[seg];
      const b = s.pts[seg + 1];
      const sl = Math.max(0.001, L[seg + 1] - L[seg]);
      const f = (d - L[seg]) / sl;
      const jx = (noise2(d * 0.05, bseed, s.seed) - 0.5) * Math.min(s.w, 6) * 0.35;
      const jy = (noise2(d * 0.05, bseed + 5, s.seed) - 0.5) * Math.min(s.w, 6) * 0.35;
      P.push({ p: [a[0] + (b[0] - a[0]) * f + jx, a[1] + (b[1] - a[1]) * f + jy], u: d / total, d, nx: -(b[1] - a[1]) / sl, ny: (b[0] - a[0]) / sl });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.dry > 0 && s.w > 7) {
      // 마른 붓: 붓털 가닥마다 따로 긋고, 가닥마다 끊김
      const nb = Math.max(4, Math.round(s.w / 2.6));
      for (let k = 0; k < nb; k++) {
        const o = (k / (nb - 1) - 0.5) * s.w;
        const lw = 0.7 + 1.6 * noise1(k * 1.7, s.seed + 9);
        const endU = 1 - Math.abs(o / s.w) * noise1(k, s.seed + 4) * 0.5;
        ctx.strokeStyle = inkA(s.alpha * (0.45 + 0.45 * noise1(k * 0.9, s.seed + 2)));
        ctx.lineWidth = lw;
        let drawing = false;
        ctx.beginPath();
        for (const q of P) {
          const tp = taperAt(s.taper, q.u);
          const gap = q.u > endU || noise1(q.d * 0.06 + k * 3.1, s.seed + bseed) < s.dry * 0.5 || Math.abs(o) > (s.w / 2) * tp + 0.5;
          const x = q.p[0] + q.nx * o * tp;
          const y = q.p[1] + q.ny * o * tp;
          if (gap) { drawing = false; continue; }
          if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      for (let i = 1; i < P.length; i++) {
        const q = P[i];
        if (s.dry > 0 && noise1(q.d * 0.08, s.seed + bseed) < s.dry * 0.55) continue;
        ctx.lineWidth = s.w * taperAt(s.taper, q.u) * (0.65 + 0.7 * noise1(q.d * 0.04, s.seed + 3));
        ctx.strokeStyle = s.paper ? paperA(s.alpha) : inkA(s.alpha * (s.dry > 0 ? 0.75 : 0.93));
        ctx.beginPath();
        ctx.moveTo(P[i - 1].p[0], P[i - 1].p[1]);
        ctx.lineTo(q.p[0], q.p[1]);
        ctx.stroke();
      }
    }
    const tip = P.length ? P[P.length - 1].p : null;
    if (s.quill && s.progress < 1 && tip) drawQuill(ctx, tip[0], tip[1], s.alpha);
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, r: Ring, boil: number): void {
    if (r.r <= 0.5 || r.alpha <= 0.01) return;
    const n = 56;
    ctx.lineCap = 'round';
    let prev: Pt | null = null;
    const turns = r.kind === 'spiral' ? 2.2 : 1;
    for (let i = 0; i <= n * turns; i++) {
      const t = (i / n) * Math.PI * 2 + r.spin;
      const rr = r.kind === 'spiral' ? r.r * (0.25 + (0.75 * i) / (n * turns)) : r.r * (0.9 + 0.2 * noise1(i * 0.3, r.seed + boil * 3));
      const p: Pt = [r.x + Math.cos(t) * rr, r.y + Math.sin(t) * rr * r.squash];
      if (prev && noise1(i * 0.25, r.seed + 40) < 0.82) {
        ctx.strokeStyle = inkA(r.alpha * 0.9);
        ctx.lineWidth = r.w * (0.4 + 0.9 * noise1(i * 0.17, r.seed));
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
      prev = p;
    }
  }
}

/** 획 끝에 보이는 깃펜 */
export function drawQuill(ctx: CanvasRenderingContext2D, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.55);
  ctx.globalAlpha = 0.9 * a;
  const vane = new Path2D();
  vane.moveTo(0, 0);
  vane.quadraticCurveTo(-3, -14, -2, -26);
  vane.quadraticCurveTo(-12, -46, -6, -72);
  vane.quadraticCurveTo(6, -50, 4, -26);
  vane.quadraticCurveTo(3, -12, 0, 0);
  ctx.fillStyle = paperA(0.92);
  ctx.fill(vane);
  ctx.strokeStyle = inkA(0.85);
  ctx.lineWidth = 1.1;
  ctx.stroke(vane);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-5, -70);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(-1.5 - i * 0.5, -30 - i * 6);
    ctx.lineTo(-8 - i * 0.4, -36 - i * 6);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.fillStyle = inkA(0.95);
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 지그재그 균열/번개 모양 점 목록 */
export function zigzag(x0: number, y0: number, ang: number, len: number, kink: number): Pt[] {
  const pts: Pt[] = [[x0, y0]];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const d = (len * i) / n;
    const off = (Math.random() - 0.5) * kink;
    pts.push([x0 + Math.cos(ang) * d - Math.sin(ang) * off, y0 + Math.sin(ang) * d + Math.cos(ang) * off]);
  }
  return pts;
}
