// 결투 공용 도구: 깃펜 획, 임팩트(히트스톱), 잉크 폭발
import { S } from '../config';
import type { Anchor, PieceEnt } from '../render/entity';
import { GEOM } from '../render/shapes';
import type { World } from '../render/world';
import type { Stroke, Taper } from '../fx/strokes';
import { rand, type Pt } from '../util/noise';

export interface Duel {
  tl: gsap.core.Timeline;
  w: World;
  A: PieceEnt;
  V: PieceEnt;
  dir: 1 | -1; // 공격자가 바라보는 방향(+1 오른쪽)
  ground: number;
}

export type Reaction = 'pierced' | 'knockback' | 'dissolve' | 'shatter' | 'split';
export interface Hit { t: number; x: number; y: number; reaction: Reaction; cutAng?: number; cutY?: number }

export const bh = (p: PieceEnt): number => GEOM[p.type].baseHalf * S;
export const ht = (p: PieceEnt): number => GEOM[p.type].height * S;

/** 깃펜이 획을 긋는다 */
export function quill(
  d: Duel, pts: Pt[], at: number, dur: number,
  o: { parent?: PieceEnt | Anchor; w?: number; taper?: Taper; dry?: number; showQuill?: boolean; paper?: boolean; alpha?: number; ease?: string } = {},
): Stroke {
  const s = d.w.strokes.add({
    pts, parent: o.parent, w: o.w ?? 4, taper: o.taper ?? 'spindle', dry: o.dry ?? 0,
    quill: o.showQuill ?? true, paper: o.paper ?? false, alpha: o.alpha ?? 1,
  });
  d.tl.to(s, { progress: 1, duration: dur, ease: o.ease ?? 'power1.inOut' }, at);
  return s;
}

/** 잉크가 마르며 사라짐 */
export function dry(d: Duel, s: Stroke, at: number, dur = 0.5): void {
  d.tl.to(s, { alpha: 0, duration: dur, ease: 'power1.in' }, at);
}

/** 펜촉이 종이를 긁고 튄 잉크: 가늘고 긴 획 + 끝에 맺힌 방울 */
export function burst(d: Duel, at: number, x: number, y: number, size: number, n = 9): void {
  d.tl.call(() => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.35, 0.35);
      const r0 = size * rand(0.25, 0.45);
      const r1 = size * rand(0.55, 1.1);
      const bend = rand(-0.15, 0.15);
      const mx = x + Math.cos(a + bend) * (r0 + r1) * 0.5;
      const my = y + Math.sin(a + bend) * (r0 + r1) * 0.5;
      const s = d.w.strokes.add({
        pts: [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [mx, my], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]],
        w: size * rand(0.022, 0.05), taper: 'in', progress: 1, quill: false, boil: false,
      });
      fadeLater(s, 0.06 + Math.random() * 0.14);
      if (Math.random() < 0.6) {
        const ex = x + Math.cos(a) * r1 * 1.08;
        const ey = y + Math.sin(a) * r1 * 1.08;
        const dot = d.w.strokes.add({ pts: [[ex, ey], [ex + 0.5, ey + 0.5]], w: size * rand(0.05, 0.09), taper: 'flat', progress: 1, quill: false, boil: false });
        fadeLater(dot, 0.12 + Math.random() * 0.15);
      }
    }
  }, [], at);
}

const fading: { s: Stroke; delay: number }[] = [];
function fadeLater(s: Stroke, delay: number): void {
  fading.push({ s, delay });
}
/** 매 프레임: 잉크 별 자연 소멸 */
export function tickBursts(dt: number): void {
  for (let i = fading.length - 1; i >= 0; i--) {
    const f = fading[i];
    f.delay -= dt;
    if (f.delay <= 0) {
      f.s.alpha -= dt * 4.5;
      if (f.s.alpha <= 0) fading.splice(i, 1);
    }
  }
}

/** 임팩트: 종이색 번쩍 → 히트스톱(움직임 정지, 선 떨림은 계속) → 흔들림 */
export function impact(
  d: Duel, t: number, x: number, y: number,
  o: { stop: number; shake: number; spray: number; ang: number; spread?: number; speed?: number; flash?: number; size?: number; sound: () => void },
): void {
  d.tl.call(() => {
    o.sound();
    d.w.flash.a = o.flash ?? 0.6;
    d.w.flash.ink = false;
    d.w.drops.spray(x, y, o.ang, o.spread ?? 0.55, o.spray, o.speed ?? 950, d.ground, 1.1, 1);
  }, [], t);
  burst(d, t, x, y, o.size ?? 60);
  d.tl.set(d.w, { fxScale: 0 }, t + 0.002);
  d.tl.set(d.w, { fxScale: 1 }, t + o.stop);
  d.tl.call(() => d.w.shake(o.shake), [], t + o.stop);
}

/** 받침 모서리 회전축. side=+1 공격 방향 쪽 모서리 */
export function edge(d: Duel, p: PieceEnt, side: number, at: number): void {
  d.tl.set(p, { pvx: side * bh(p), pvy: 0 }, at);
}
