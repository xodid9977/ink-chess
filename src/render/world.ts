// 장면 전체: 카메라, 말, 잉크 효과, 결투용 '물로 씻기' 오버레이
import { BOARD, S, inkA, paperA } from '../config';
import { InkDrops } from '../fx/drops';
import { Frags } from '../fx/fragments';
import { Strokes } from '../fx/strokes';
import { noise1, noise2 } from '../util/noise';
import { boilFrame, drawPiece, drawShadow, pushTrail, type PieceEnt } from './entity';
import { BOARD_MARGIN, makeBoard, makePaper } from './paper';

export interface Cam { cx: number; cy: number; zoom: number; rot: number }
export interface Marker { sq: string; kind: 'move' | 'capture'; s: number }

export const HOME: Cam = { cx: BOARD / 2, cy: BOARD / 2 - 18, zoom: 1, rot: 0 };

export class World {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  vw = 0;
  vh = 0;
  base = 1;
  cam: Cam = { ...HOME };
  shakeAmp = 0;
  shakeT = 0;
  pieces: PieceEnt[] = [];
  drops = new InkDrops();
  strokes = new Strokes();
  frags = new Frags();
  fxScale = 1;
  wash = { x: 0, y: 0, r: 0, a: 0 };
  vignette = 0;
  flash = { a: 0, ink: false };
  markers: Marker[] = [];
  lastMove: string[] = [];
  checkSq: string | null = null;
  /** 선택된 칸: t는 펜으로 둥글게 그려지는 진행도 */
  sel: { sq: string; t: number } | null = null;
  time = 0;
  private trailTick = 0;
  private paper: HTMLCanvasElement;
  private board: HTMLCanvasElement;
  private boardK = 2.4;
  private paperPat: CanvasPattern | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d');
    this.ctx = ctx;
    this.paper = makePaper();
    this.board = makeBoard(this.paper, this.boardK);
    this.paperPat = ctx.createPattern(this.paper, 'repeat');
  }

  /** 폰트 로드 후 좌표 글씨를 다시 그리기 */
  flipped = false;
  rebuildBoard(): void {
    this.board = makeBoard(this.paper, this.boardK, this.flipped);
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = w;
    this.vh = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.base = Math.min(w / (BOARD + 110), h / (BOARD + 150));
  }

  shake(amp: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = 0;
  }

  toWorld(sx: number, sy: number): [number, number] {
    const z = this.base * this.cam.zoom;
    const x = (sx - this.vw / 2) / z;
    const y = (sy - this.vh / 2) / z;
    const c = Math.cos(-this.cam.rot);
    const s = Math.sin(-this.cam.rot);
    return [x * c - y * s + this.cam.cx, x * s + y * c + this.cam.cy];
  }

  /** 현재 화면에 보이는 월드 폭 */
  viewW(): number {
    return this.vw / (this.base * this.cam.zoom);
  }

  update(dt: number): void {
    this.time += dt;
    const fdt = dt * this.fxScale;
    this.drops.update(fdt);
    this.frags.update(fdt, this.drops);
    this.strokes.prune();
    this.shakeT += dt;
    this.shakeAmp *= Math.exp(-dt * 7);
    this.flash.a *= Math.exp(-dt * 16);
    if ((this.trailTick += dt) > 0.035) {
      this.trailTick = 0;
      for (const p of this.pieces) pushTrail(p);
    }
  }

  draw(): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.paperPat ?? '#f1eee7';
    ctx.fillRect(0, 0, this.vw, this.vh);
    const z = this.base * this.cam.zoom;
    const sx = (noise1(this.shakeT * 38, 1) - 0.5) * 2 * this.shakeAmp;
    const sy = (noise1(this.shakeT * 38, 2) - 0.5) * 2 * this.shakeAmp;
    ctx.translate(this.vw / 2 + sx, this.vh / 2 + sy);
    ctx.rotate(this.cam.rot);
    ctx.scale(z, z);
    ctx.translate(-this.cam.cx, -this.cam.cy);
    const M = BOARD_MARGIN;
    ctx.drawImage(this.board, -M, -M, BOARD + 2 * M, BOARD + 2 * M);
    this.drawSquareMarks();
    ctx.globalCompositeOperation = 'multiply';
    this.drops.drawStains(ctx);
    ctx.globalCompositeOperation = 'source-over';
    this.drawMarkers();
    const t = this.time;
    const bg = this.pieces.filter((p) => !p.focus).sort((a, b) => a.y - b.y);
    for (const p of bg) drawShadow(ctx, p);
    for (const p of bg) drawPiece(ctx, p, t);
    this.drawWash();
    const fg = this.pieces.filter((p) => p.focus).sort((a, b) => a.y - b.y);
    if (this.wash.a > 0.02) {
      ctx.globalCompositeOperation = 'multiply';
      this.drops.drawStains(ctx);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const p of fg) drawShadow(ctx, p);
    for (const p of fg) drawPiece(ctx, p, t);
    this.frags.draw(ctx, t);
    this.strokes.draw(ctx, boilFrame(t));
    this.drops.drawDrops(ctx);
    // 화면 공간 효과
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawVignette();
    if (this.flash.a > 0.01) {
      ctx.fillStyle = this.flash.ink ? inkA(this.flash.a) : paperA(this.flash.a);
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }

  /** 칸의 왼쪽 위 모서리 (판 뒤집기 반영) */
  sqXY(sq: string): [number, number] {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]);
    return this.flipped ? [(7 - f) * S, (r - 1) * S] : [f * S, (8 - r) * S];
  }

  /** 월드 좌표 → 칸 이름 */
  sqAt(wx: number, wy: number): string | null {
    const c = Math.floor(wx / S);
    const row = Math.floor(wy / S);
    if (c < 0 || c > 7 || row < 0 || row > 7) return null;
    return this.flipped ? String.fromCharCode(97 + 7 - c) + (row + 1) : String.fromCharCode(97 + c) + (8 - row);
  }

  private drawSquareMarks(): void {
    const { ctx } = this;
    if (this.sel && this.sel.t > 0) {
      const [x0, y0] = this.sqXY(this.sel.sq);
      ctx.fillStyle = inkA(0.1 * this.sel.t);
      ctx.fillRect(x0 + 2, y0 + 2, S - 4, S - 4);
      // 받침 둘레에 펜으로 두 번 감아 그린 고리
      const cx = x0 + S / 2;
      const cy = y0 + S / 2 + 0.3 * S;
      const b = boilFrame(this.time);
      const turns = 1.25 * this.sel.t;
      ctx.lineCap = 'round';
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 60 * turns; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI * 0.6;
        const k = 1 + 0.06 * (noise2(i * 0.3, b, 5) - 0.5) + i * 0.0012;
        const p: [number, number] = [cx + Math.cos(a) * 39 * k, cy + Math.sin(a) * 13 * k];
        if (prev) {
          ctx.strokeStyle = inkA(0.85);
          ctx.lineWidth = 1.2 + 1.8 * noise1(i * 0.2, 9);
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(p[0], p[1]);
          ctx.stroke();
        }
        prev = p;
      }
    }
    for (const sq of this.lastMove) {
      const [x, y] = this.sqXY(sq);
      ctx.strokeStyle = inkA(0.13);
      ctx.lineWidth = 1;
      for (let i = 6; i < S * 2; i += 7) {
        ctx.beginPath();
        ctx.moveTo(x + Math.max(0, i - S), y + Math.min(i, S));
        ctx.lineTo(x + Math.min(i, S), y + Math.max(0, i - S));
        ctx.stroke();
      }
    }
    if (this.checkSq) {
      const [x, y] = this.sqXY(this.checkSq);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      const g = this.ctx.createRadialGradient(x + S / 2, y + S / 2, 10, x + S / 2, y + S / 2, S * 0.62);
      g.addColorStop(0, inkA(0));
      g.addColorStop(1, inkA(0.25 + pulse * 0.25));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, S, S);
    }
  }

  private drawMarkers(): void {
    const { ctx } = this;
    const b = boilFrame(this.time);
    for (const m of this.markers) {
      if (m.s <= 0.01) continue;
      const [x0, y0] = this.sqXY(m.sq);
      const x = x0 + S / 2;
      const y = y0 + S / 2;
      const seed = x0 * 0.13 + y0 * 0.07;
      ctx.beginPath();
      const n = 18;
      const R = m.kind === 'move' ? 11 * m.s : 40 * m.s;
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * Math.PI * 2;
        const k = 0.8 + 0.35 * noise2(i * 0.6, b, seed);
        const px = x + Math.cos(t) * R * k;
        const py = y + Math.sin(t) * R * k;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      if (m.kind === 'move') {
        ctx.fillStyle = inkA(0.45);
        ctx.fill();
      } else {
        ctx.strokeStyle = inkA(0.6);
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
    }
  }

  private drawWash(): void {
    const w = this.wash;
    if (w.a <= 0.01 || w.r <= 1) return;
    const { ctx } = this;
    ctx.beginPath();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const k = 0.75 + 0.45 * noise1(i * 0.45, 3);
      const px = w.x + Math.cos(t) * w.r * k;
      const py = w.y + Math.sin(t) * w.r * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = w.a;
    ctx.fillStyle = this.paperPat ?? '#f1eee7';
    ctx.fill();
    ctx.globalAlpha = w.a * 0.35;
    ctx.strokeStyle = inkA(0.5);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  private drawVignette(): void {
    if (this.vignette <= 0.01) return;
    const { ctx, vw, vh } = this;
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    g.addColorStop(0, inkA(0));
    g.addColorStop(0.7, inkA(0.22 * this.vignette));
    g.addColorStop(1, inkA(0.62 * this.vignette));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  clearTransient(): void {
    this.drops.clearTransient();
    this.frags.clear();
    this.strokes.clear();
    this.fxScale = 1;
  }
}
