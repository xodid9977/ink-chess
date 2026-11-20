// 보드 위 말 엔티티와 그리기
import { ART, S, inkA } from '../config';
import { getArt } from './pieceArt';
import type { Color, PieceType } from './shapes';
import { noise1 } from '../util/noise';

export interface Blot { lx: number; ly: number; r: number; a: number }

export interface PieceEnt {
  id: number;
  type: PieceType;
  color: Color;
  x: number;
  y: number; // 받침 중앙(월드)
  lift: number;
  rot: number;
  pvx: number;
  pvy: number; // 회전축(로컬, 위쪽이 -)
  sx: number;
  sy: number;
  alpha: number;
  flip: 1 | -1;
  focus: boolean;
  visible: boolean;
  ghost: boolean;
  trail: { x: number; y: number; rot: number; lift: number; sx: number }[];
  dissolve: number;
  reveal: number;
  blots: Blot[];
  boilOff: number;
  shadow: number;
}

/** 무기·효과 획을 붙일 수 있는 단순 기준점 */
export interface Anchor { x: number; y: number; rot: number }

let nextId = 1;
export function makePiece(type: PieceType, color: Color, x: number, y: number): PieceEnt {
  return {
    id: nextId++, type, color, x, y, lift: 0, rot: 0, pvx: 0, pvy: 0, sx: 1, sy: 1, alpha: 1,
    flip: 1, focus: false, visible: true, ghost: false, trail: [], dissolve: 0, reveal: 1, blots: [],
    boilOff: Math.floor(Math.random() * 3), shadow: 1,
  };
}

export function applyPieceTf(ctx: CanvasRenderingContext2D, p: PieceEnt, withFlip = true): void {
  ctx.translate(p.x, p.y - p.lift);
  ctx.translate(p.pvx, p.pvy);
  ctx.rotate(p.rot);
  ctx.translate(-p.pvx, -p.pvy);
  ctx.scale(p.sx * (withFlip ? p.flip : 1), p.sy);
}

export function boilFrame(t: number, off = 0): number {
  return (Math.floor(t * ART.boilFps) + off) % ART.boilFrames;
}

export function drawShadow(ctx: CanvasRenderingContext2D, p: PieceEnt): void {
  if (!p.visible || p.shadow <= 0) return;
  const l = Math.max(0, p.lift);
  const k = 1 + l / 160;
  const a = (0.2 / k) * p.shadow * p.alpha * (1 - p.dissolve);
  const g = ctx.createRadialGradient(p.x, p.y + 2, 1, p.x, p.y + 2, 0.34 * S * k);
  g.addColorStop(0, inkA(a));
  g.addColorStop(1, inkA(0));
  ctx.save();
  ctx.translate(p.x, p.y + 2);
  ctx.scale(1, 0.24);
  ctx.translate(-p.x, -(p.y + 2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 2, 0.34 * S * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawImg(ctx: CanvasRenderingContext2D, p: PieceEnt, frame: number): void {
  const art = getArt(p.type, p.color);
  const k = S / art.R;
  const img = art.frames[frame];
  if (p.dissolve <= 0.001) {
    ctx.drawImage(img, -art.ox * k, -art.oy * k, art.w * k, art.h * k);
    return;
  }
  // 젖은 잉크가 흘러내리듯 세로 띠로 나눠 아래로 늘어뜨림
  const d = p.dissolve;
  const strips = 28;
  const sw = art.w / strips;
  for (let i = 0; i < strips; i++) {
    const n = noise1(i * 0.6, p.id);
    const dy = d * d * (40 + 70 * n);
    const stretch = 1 + d * (0.25 + 0.6 * n);
    ctx.globalAlpha = p.alpha * Math.max(0, 1 - d * (0.8 + 0.5 * n));
    ctx.drawImage(img, i * sw, 0, sw + 0.5, art.h, (-art.ox + i * sw) * k, -art.oy * k + dy - (stretch - 1) * art.h * k * 0.3, (sw + 0.5) * k, art.h * k * stretch);
  }
  ctx.globalAlpha = 1;
}

export function drawPiece(ctx: CanvasRenderingContext2D, p: PieceEnt, t: number): void {
  if (!p.visible || p.alpha <= 0) return;
  const frame = boilFrame(t, p.boilOff);
  // 잔상 (먹물만 남은 실루엣)
  if (p.trail.length) {
    const art = getArt(p.type, p.color);
    p.trail.forEach((g, i) => {
      ctx.save();
      ctx.globalAlpha = (0.32 - i * 0.09) * p.alpha;
      ctx.translate(g.x, g.y - g.lift);
      ctx.rotate(g.rot);
      ctx.scale(g.sx * p.flip, 1);
      ctx.fillStyle = inkA(p.color === 'b' ? 0.8 : 0.35);
      ctx.fill(art.path);
      ctx.restore();
    });
  }
  ctx.save();
  applyPieceTf(ctx, p);
  ctx.globalAlpha = p.alpha;
  if (p.reveal < 1) {
    const top = -1.1 * S * p.reveal + 4;
    ctx.beginPath();
    ctx.rect(-S, top, 2 * S, 2 * S);
    ctx.clip();
  }
  drawImg(ctx, p, frame);
  if (p.blots.length) {
    const art = getArt(p.type, p.color);
    ctx.save();
    ctx.clip(art.path);
    for (const b of p.blots) {
      if (b.r <= 0) continue;
      const g = ctx.createRadialGradient(b.lx, b.ly, 0, b.lx, b.ly, b.r);
      g.addColorStop(0, inkA(b.a));
      g.addColorStop(0.75, inkA(b.a * 0.85));
      g.addColorStop(0.92, inkA(b.a));
      g.addColorStop(1, inkA(0));
      ctx.fillStyle = g;
      ctx.fillRect(b.lx - b.r, b.ly - b.r, b.r * 2, b.r * 2);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function pushTrail(p: PieceEnt): void {
  if (!p.ghost) {
    if (p.trail.length) p.trail.pop();
    return;
  }
  p.trail.unshift({ x: p.x, y: p.y, rot: p.rot, lift: p.lift, sx: p.sx });
  if (p.trail.length > 3) p.trail.length = 3;
}
