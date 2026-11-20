// 잘리거나 부서진 말 조각
import { S, inkA } from '../config';
import { boilFrame, type PieceEnt } from '../render/entity';
import { getArt } from '../render/pieceArt';
import type { Color, PieceType } from '../render/shapes';
import type { InkDrops } from './drops';
import { rand, type Pt } from '../util/noise';

export interface Frag {
  type: PieceType; color: Color; flip: 1 | -1;
  x: number; y: number; rot: number; pvx: number; pvy: number; alpha: number; visible: boolean;
  clip: Pt[]; cut: Pt[]; // 로컬 좌표 (받침 중앙 원점)
  physics: boolean; vx: number; vy: number; vr: number; ground: number; landed: number;
}

export class Frags {
  list: Frag[] = [];

  private base(p: PieceEnt, clip: Pt[], cut: Pt[]): Frag {
    return {
      type: p.type, color: p.color, flip: p.flip, x: p.x, y: p.y - p.lift, rot: p.rot, pvx: 0, pvy: 0,
      alpha: 1, visible: false, clip, cut, physics: false, vx: 0, vy: 0, vr: 0, ground: p.y, landed: 0,
    };
  }

  /** 직선 하나로 두 동강. ang: 베는 선 각도(라디안), (cx,cy): 선이 지나는 로컬 점 */
  split(p: PieceEnt, ang: number, cx: number, cy: number): [Frag, Frag] {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const B = 3 * S;
    const a: Pt = [cx - dx * B, cy - dy * B];
    const b: Pt = [cx + dx * B, cy + dy * B];
    const side = ny < 0 ? 1 : -1; // 위쪽(-y)을 향한 법선 방향
    const up: Pt[] = [a, b, [b[0] + nx * B * side, b[1] + ny * B * side], [a[0] + nx * B * side, a[1] + ny * B * side]];
    const dn: Pt[] = [a, b, [b[0] - nx * B * side, b[1] - ny * B * side], [a[0] - nx * B * side, a[1] - ny * B * side]];
    const cut: Pt[] = [[cx - dx * 0.45 * S, cy - dy * 0.45 * S], [cx + dx * 0.45 * S, cy + dy * 0.45 * S]];
    const top = this.base(p, up, cut);
    const bot = this.base(p, dn, cut);
    this.list.push(top, bot);
    return [top, bot];
  }

  /** 충격점 기준 방사형 조각들 */
  shatter(p: PieceEnt, cx: number, cy: number, n: number): Frag[] {
    const out: Frag[] = [];
    const B = 2 * S;
    const angs: number[] = [];
    for (let i = 0; i < n; i++) angs.push(((i + rand(-0.3, 0.3)) / n) * Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a0 = angs[i];
      const a1 = angs[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0);
      const mid = (a0 + a1) / 2;
      const clip: Pt[] = [[cx, cy], [cx + Math.cos(a0) * B, cy + Math.sin(a0) * B], [cx + Math.cos(mid) * B * 1.2, cy + Math.sin(mid) * B * 1.2], [cx + Math.cos(a1) * B, cy + Math.sin(a1) * B]];
      const f = this.base(p, clip, [[cx, cy], [cx + Math.cos(a0) * 0.3 * S, cy + Math.sin(a0) * 0.3 * S]]);
      f.pvx = cx + Math.cos(mid) * 0.15 * S;
      f.pvy = cy + Math.sin(mid) * 0.15 * S;
      const sp = rand(350, 900);
      f.vx = Math.cos(mid) * sp;
      f.vy = Math.sin(mid) * sp - rand(250, 650);
      f.vr = rand(-14, 14);
      f.ground = p.y + rand(-10, 30);
      f.physics = true;
      out.push(f);
      this.list.push(f);
    }
    return out;
  }

  update(dt: number, drops: InkDrops): void {
    for (const f of this.list) {
      if (!f.physics || !f.visible) continue;
      if (f.landed > 0) {
        f.landed += dt;
        f.alpha = Math.max(0, 1 - (f.landed - 0.5) / 0.5);
        continue;
      }
      f.vy += 2400 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.y > f.ground && f.vy > 0) {
        if (Math.abs(f.vy) > 500) {
          f.vy *= -0.3;
          f.vx *= 0.5;
          f.vr *= 0.5;
          drops.stain(f.x, f.ground, rand(6, 14), { a: 0.6, persist: 0.09 });
        } else {
          f.landed = 0.001;
          drops.stain(f.x, f.ground, rand(10, 18), { a: 0.6, persist: 0.1, grow: 0.5 });
        }
        f.y = f.ground;
      }
    }
    this.list = this.list.filter((f) => f.alpha > 0.01);
  }

  clear(): void {
    this.list = [];
  }

  draw(ctx: CanvasRenderingContext2D, t: number): void {
    for (const f of this.list) {
      if (!f.visible || f.alpha <= 0) continue;
      const art = getArt(f.type, f.color);
      const k = S / art.R;
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(f.x, f.y);
      ctx.translate(f.pvx, f.pvy);
      ctx.rotate(f.rot);
      ctx.translate(-f.pvx, -f.pvy);
      ctx.beginPath();
      f.clip.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.save();
      ctx.scale(f.flip, 1);
      ctx.drawImage(art.frames[boilFrame(t)], -art.ox * k, -art.oy * k, art.w * k, art.h * k);
      ctx.restore();
      ctx.restore();
      // 잘린 단면: 먹이 고인 테두리
      ctx.save();
      ctx.scale(f.flip, 1);
      ctx.clip(art.path);
      ctx.scale(f.flip, 1);
      ctx.strokeStyle = inkA(0.85);
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.cut[0][0], f.cut[0][1]);
      ctx.lineTo(f.cut[1][0], f.cut[1][1]);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
  }
}
