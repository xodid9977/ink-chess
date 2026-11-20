// 잉크 방울(날아가는 획 → 착지 시 번지는 얼룩) 과 얼룩 데칼
import { inkA } from '../config';
import { noise1, rand } from '../util/noise';

interface Drop { x: number; y: number; vx: number; vy: number; r: number; ground: number; stainK: number }
export interface Stain {
  x: number; y: number; R: number; shape: number[]; a: number; persist: number;
  age: number; grow: number; hold: number; fade: number; transient: boolean;
}

const G = 2600;
const MAX_STAINS = 260;

export class InkDrops {
  drops: Drop[] = [];
  stains: Stain[] = [];

  spray(x: number, y: number, angle: number, spread: number, count: number, speed: number, ground: number, size = 1, stainK = 1): void {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread);
      const v = speed * rand(0.35, 1.15);
      this.drops.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: size * rand(1.2, 4.2),
        ground: ground + rand(-14, 22), stainK,
      });
    }
    this.step(0.012);
  }

  /** 아래로 똑똑 떨어지는 방울 */
  drip(x: number, y: number, ground: number, size = 1): void {
    this.drops.push({ x, y, vx: rand(-20, 20), vy: rand(0, 60), r: size * rand(1.5, 3.5), ground, stainK: 1 });
  }

  stain(x: number, y: number, R: number, o: { a?: number; persist?: number; grow?: number; hold?: number; fade?: number; transient?: boolean } = {}): Stain {
    const n = 36;
    const seed = Math.random() * 1000;
    const shape: number[] = [];
    for (let i = 0; i < n; i++) {
      // 둥근 물방울 번짐 + 드물게 가는 꼬리
      const spike = Math.random() < 0.05 ? rand(0.1, 0.35) : 0;
      shape.push(0.8 + 0.3 * noise1(i * 0.32, seed) + spike);
    }
    // 시작과 끝이 이어지도록
    shape[n - 1] = (shape[n - 2] + shape[0]) / 2;
    const s: Stain = {
      x, y, R, shape, a: o.a ?? 0.55, persist: o.persist ?? 0, age: 0, grow: o.grow ?? 0.28,
      hold: o.hold ?? 0.5, fade: o.fade ?? 1.2, transient: o.transient ?? true,
    };
    this.stains.push(s);
    if (this.stains.length > MAX_STAINS) {
      const idx = this.stains.findIndex((q) => q.age > q.grow + q.hold + q.fade);
      this.stains.splice(idx >= 0 ? idx : 0, 1);
    }
    return s;
  }

  step(dt: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += G * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= d.ground && d.vy > 0) {
        this.stain(d.x, d.ground, d.r * rand(1.6, 3) * d.stainK, { a: 0.6, persist: 0.1 * d.stainK, grow: 0.18, hold: 0.4, fade: 1.6 });
        if (d.r > 3 && Math.random() < 0.6) {
          for (let k = 0; k < 2; k++) this.stain(d.x + rand(-d.r * 4, d.r * 4), d.ground + rand(-3, 3), d.r * 0.5, { a: 0.5, persist: 0.06, grow: 0.12 });
        }
        this.drops.splice(i, 1);
      }
    }
  }

  update(dt: number): void {
    this.step(dt);
    for (const s of this.stains) s.age += dt;
    this.stains = this.stains.filter((s) => s.persist > 0 || s.age < s.grow + s.hold + s.fade);
  }

  clearTransient(): void {
    this.drops = [];
  }

  private alphaOf(s: Stain): number {
    const t = s.age - s.grow - s.hold;
    if (t <= 0) return s.a;
    const k = Math.min(1, t / s.fade);
    return s.a + (s.persist - s.a) * k;
  }

  drawStains(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stains) {
      const a = this.alphaOf(s);
      if (a <= 0.003) continue;
      const g = Math.min(1, s.age / s.grow);
      const r = s.R * (1 - Math.pow(1 - g, 3));
      if (r <= 0.2) continue;
      const n = s.shape.length;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const k = s.shape[i % n];
        const t = (i / n) * Math.PI * 2;
        const x = s.x + Math.cos(t) * r * k;
        const y = s.y + Math.sin(t) * r * k * 0.62;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = inkA(a * 0.55);
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, r * 0.14);
      ctx.strokeStyle = inkA(a * 0.45);
      ctx.stroke();
    }
  }

  drawDrops(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    for (const d of this.drops) {
      ctx.strokeStyle = inkA(0.9);
      ctx.lineWidth = d.r;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.vx * 0.022, d.y - d.vy * 0.022);
      ctx.stroke();
    }
  }
}
