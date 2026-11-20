// 공격 안무 6종 — 모두 예비 동작 → 동작 → 임팩트(히트스톱) → 여운
import { DUEL } from '../config';
import { sfx } from '../audio/sfx';
import type { Anchor } from '../render/entity';
import type { PieceType } from '../render/shapes';
import { zigzag } from '../fx/strokes';
import { rad, rand, type Pt } from '../util/noise';
import { dry, edge, ht, impact, quill, type Duel, type Hit } from './common';

const fwdAng = (dir: number, up = 0.25): number => (dir > 0 ? -up : Math.PI + up);

/** 폰 — 찌르기: 떨면서도 용감한 신병 */
function pierce(d: Duel, t: number): Hit {
  const { tl, A, V, dir } = d;
  const sX = V.x - dir * 95;
  const y0 = -36;
  const spear = quill(d, [[-dir * 10, y0 + 3], [dir * 20, y0], [dir * 46, y0 - 1.5], [dir * 68, y0 - 3]], t, 0.22, { parent: A, w: 3.6, taper: 'flat', ease: 'power2.out' });
  const tip1 = quill(d, [[dir * 70, y0 - 3], [dir * 55, y0 - 11]], t + 0.22, 0.05, { parent: A, w: 3.2, taper: 'out' });
  const tip2 = quill(d, [[dir * 70, y0 - 3], [dir * 55, y0 + 5]], t + 0.27, 0.05, { parent: A, w: 3.2, taper: 'out' });
  tl.call(() => { d.w.drops.drip(A.x + dir * 66, A.y + y0, d.ground + 6, 0.9); sfx.drip(); }, [], t + 0.34);
  // 예비: 뒤로 젖히며 긴장으로 떨림
  edge(d, A, -dir, t + 0.3);
  tl.to(A, { rot: rad(-dir * 13), x: sX - dir * 12, duration: 0.24, ease: 'power2.out' }, t + 0.32);
  tl.to(A, { rot: `+=${rad(dir * 1.3)}`, duration: 0.028, yoyo: true, repeat: 7, ease: 'none' }, t + 0.56);
  // 동작
  const tA = t + 0.8;
  tl.set(A, { ghost: true }, tA - 0.02);
  tl.call(() => sfx.whoosh(), [], tA - 0.03);
  tl.to(A, { x: V.x - dir * 60, rot: rad(dir * 17), duration: 0.09, ease: 'power4.in' }, tA);
  const tI = tA + 0.09;
  impact(d, tI, V.x - dir * 4, V.y - 38, { stop: 0.1, shake: 7, spray: 24, ang: fwdAng(dir, 0.35), spread: 0.45, sound: sfx.stab, size: 55 });
  // 여운: 반동 후 받침 위에서 까딱이며 정착
  tl.set(A, { ghost: false }, tI + 0.1);
  tl.to(A, { x: V.x - dir * 80, rot: rad(-dir * 4), duration: 0.2, ease: 'power2.out' }, tI + 0.1);
  tl.to(A, { rot: rad(dir * 2.5), duration: 0.09, ease: 'sine.inOut' }, '>');
  tl.to(A, { rot: rad(-dir * 1), duration: 0.08, ease: 'sine.inOut' }, '>');
  tl.to(A, { rot: 0, duration: 0.08, ease: 'sine.out' }, '>');
  [spear, tip1, tip2].forEach((s) => dry(d, s, tI + 0.55, 0.55));
  return { t: tI + 0.1, x: V.x, y: V.y - 38, reaction: 'pierced' };
}

/** 나이트 — 돌진: 앞발을 들고 뛰어들어 관통 */
function charge(d: Duel, t: number): Hit {
  const { tl, A, V, dir, w } = d;
  const sX = V.x - dir * 95;
  const lance = quill(d, [[-dir * 12, -54], [dir * 30, -50], [dir * 84, -44]], t, 0.24, { parent: A, w: 5.5, taper: 'out', ease: 'power2.out' });
  const speed: ReturnType<typeof quill>[] = [];
  for (let i = 0; i < 3; i++) speed.push(quill(d, [[-dir * 28, -28 - i * 15], [-dir * (62 + i * 8), -28 - i * 15]], t + 0.62 + i * 0.03, 0.08, { parent: A, w: 1.8, taper: 'out', showQuill: false }));
  edge(d, A, -dir, t + 0.26);
  tl.to(A, { rot: rad(-dir * 22), lift: 24, duration: 0.3, ease: 'back.out(2)' }, t + 0.28);
  tl.call(() => w.drops.spray(sX - dir * 18, V.y - 4, fwdAng(-dir, 0.6), 0.4, 7, 260, d.ground + 4, 0.7, 0.5), [], t + 0.3);
  tl.call(() => sfx.thud(0.5), [], t + 0.3);
  const tA = t + 0.66;
  tl.set(A, { ghost: true }, tA);
  tl.call(() => sfx.whoosh(), [], tA);
  tl.to(A, { x: V.x - dir * 64, duration: 0.24, ease: 'power2.in' }, tA);
  tl.to(A, { lift: 58, duration: 0.12, ease: 'power2.out' }, tA);
  tl.to(A, { lift: 18, duration: 0.12, ease: 'power2.in' }, tA + 0.12);
  tl.to(A, { rot: rad(dir * 15), duration: 0.24, ease: 'power1.in' }, tA);
  const tI = tA + 0.24;
  impact(d, tI, V.x - dir * 8, V.y - ht(V) * 0.62, { stop: 0.12, shake: 10, spray: 20, ang: fwdAng(dir, 0.5), spread: 0.6, sound: () => sfx.thud(1.3), size: 75 });
  const ring = w.strokes.ring({ x: V.x, y: V.y - ht(V) * 0.5, r: 0, w: 3.5, squash: 0.85 });
  tl.to(ring, { r: 92, duration: 0.4, ease: 'power2.out' }, tI + 0.12);
  tl.to(ring, { alpha: 0, w: 1, duration: 0.4, ease: 'power1.in' }, tI + 0.12);
  tl.to(w.cam, { zoom: DUEL.zoom * 1.09, duration: 0.04 }, tI);
  tl.to(w.cam, { zoom: DUEL.zoom, duration: 0.25, ease: 'power2.out' }, tI + 0.13);
  // 여운: 관통해 지나가 미끄러지고 뒤돌아봄
  tl.set(A, { ghost: false }, tI + 0.3);
  tl.to(A, { x: V.x + dir * 88, duration: 0.34, ease: 'power2.out' }, tI + 0.12);
  tl.to(A, { lift: 0, duration: 0.18, ease: 'power2.in' }, tI + 0.12);
  tl.to(A, { rot: 0, duration: 0.45, ease: 'elastic.out(1,0.4)' }, tI + 0.3);
  for (const o of [-4, 3]) {
    const s = quill(d, [[V.x - dir * 10, V.y + o], [V.x + dir * 88, V.y + o * 1.5]], tI + 0.28, 0.22, { w: 2, dry: 0.7, taper: 'out', showQuill: false, alpha: 0.7 });
    dry(d, s, tI + 0.9, 0.6);
  }
  tl.to(A, { sx: -1, duration: 0.16, ease: 'power2.inOut' }, tI + 0.62);
  dry(d, lance, tI + 0.4, 0.5);
  speed.forEach((s) => dry(d, s, tI, 0.3));
  return { t: tI + 0.12, x: V.x, y: V.y - 50, reaction: 'knockback' };
}

/** 비숍 — 잉크 마법: 발밑에 주문을 '쓰고' 리본으로 휘감음 */
function magic(d: Duel, t: number): Hit {
  const { tl, A, V, dir, w } = d;
  const sX = V.x - dir * 95;
  tl.to(A, { lift: 16, duration: 0.35, ease: 'sine.inOut' }, t);
  tl.to(A, { lift: 23, duration: 0.28, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t + 0.35);
  tl.call(() => sfx.magic(), [], t + 0.1);
  const ell: Pt[] = [];
  for (let i = 0; i <= 44; i++) {
    const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
    ell.push([sX + Math.cos(a) * 50, V.y + 2 + Math.sin(a) * 15]);
  }
  const sig: ReturnType<typeof quill>[] = [quill(d, ell, t + 0.05, 0.45, { w: 2.4, taper: 'flat' })];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const cx = sX + Math.cos(a) * 50;
    const cy = V.y + 2 + Math.sin(a) * 15;
    sig.push(quill(d, [[cx, cy], [cx + Math.cos(a) * 9, cy + Math.sin(a) * 4 - 6], [cx + Math.cos(a) * 15, cy + Math.sin(a) * 6 + 2]], t + 0.5 + k * 0.045, 0.045, { w: 2, taper: 'out' }));
  }
  const head = { x: sX, y: V.y - 80 - 30 };
  const spiral = w.strokes.ring({ x: head.x, y: head.y, r: 0, w: 3, squash: 0.85, kind: 'spiral', alpha: 0 });
  tl.to(spiral, { r: 34, alpha: 1, spin: 9, duration: 0.42, ease: 'power2.in' }, t + 0.78);
  tl.call(() => { for (let i = 0; i < 8; i++) w.drops.spray(sX + rand(-40, 40), V.y, -Math.PI / 2, 0.2, 1, 500, d.ground, 0.6, 0.3); }, [], t + 0.8);
  const tR = t + 1.2;
  tl.to(spiral, { alpha: 0, r: 10, duration: 0.12 }, tR);
  const vy = V.y - ht(V) * 0.55;
  const rib: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    rib.push([head.x + (V.x - head.x) * u, head.y + (vy - head.y) * u - Math.sin(u * Math.PI) * 34]);
  }
  const ribbon = quill(d, rib, tR, 0.14, { w: 10, taper: 'in', showQuill: false, ease: 'power3.in' });
  const wrap: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 4;
    wrap.push([V.x + Math.cos(a) * 33, V.y - ht(V) * 0.8 + (i / 48) * ht(V) * 0.65 + Math.sin(a) * 9]);
  }
  const tI = tR + 0.14;
  const wr = quill(d, wrap, tI, 0.24, { w: 5, taper: 'flat', showQuill: false });
  impact(d, tI, V.x, vy, { stop: 0.08, shake: 4, spray: 10, ang: fwdAng(dir, 0.3), sound: sfx.splat, size: 45 });
  dry(d, ribbon, tI + 0.3, 0.4);
  dry(d, wr, tI + 0.9, 0.5);
  sig.forEach((s) => dry(d, s, tI + 0.4, 0.6));
  tl.to(A, { lift: 0, duration: 0.3, ease: 'bounce.out' }, tI + 0.7);
  return { t: tI + 0.22, x: V.x, y: vy, reaction: 'dissolve' };
}

/** 룩 — 분쇄: 떠올라 조준하고 그대로 내리찍음 */
function crush(d: Duel, t: number): Hit {
  const { tl, A, V, w } = d;
  tl.set(A, { pvx: 0, pvy: -30 }, t);
  tl.to(A, { lift: 88, duration: 0.45, ease: 'sine.inOut' }, t);
  for (const k of [0.12, 0.25, 0.38]) tl.call(() => { for (let i = 0; i < 3; i++) w.drops.drip(A.x + rand(-24, 24), A.y - A.lift, d.ground + rand(-4, 14), 0.6); }, [], t + k);
  tl.to(A, { x: V.x, duration: 0.3, ease: 'power2.inOut' }, t + 0.45);
  edge(d, V, d.dir, t + 0.45);
  tl.to(V, { rot: rad(d.dir * 6), duration: 0.25, ease: 'power2.out' }, t + 0.5);
  tl.to(A, { rot: rad(2.5), duration: 0.06, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t + 0.76);
  tl.call(() => sfx.whoosh(), [], t + 0.98);
  tl.to(A, { lift: ht(V) * 0.92, rot: 0, duration: 0.08, ease: 'expo.in' }, t + 1.0);
  const tI = t + 1.08;
  impact(d, tI, V.x, V.y - ht(V) * 0.8, { stop: 0.14, shake: 13, spray: 28, ang: -Math.PI / 2, spread: 1.35, speed: 820, flash: 0.75, sound: sfx.crush, size: 85 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI + rand(-0.2, 0.2);
    const pts = zigzag(V.x, V.y + 3, a, rand(55, 95), 16).map(([x, y]): Pt => [x, V.y + 3 + (y - V.y - 3) * 0.32]);
    const s = quill(d, pts, tI + 0.14 + i * 0.015, 0.16, { w: 2.4, taper: 'out', showQuill: false, alpha: 0.85 });
    dry(d, s, tI + 1.2, 0.8);
  }
  tl.call(() => w.drops.stain(V.x, V.y + 4, 62, { a: 0.55, persist: DUEL.battleStainAlpha, grow: 0.35, hold: 0.6, fade: 1.5 }), [], tI + 0.14);
  tl.to(A, { lift: 0, duration: 0.07, ease: 'power2.in' }, tI + 0.14);
  tl.to(A, { lift: 8, duration: 0.09, yoyo: true, repeat: 1, ease: 'sine.out' }, tI + 0.22);
  return { t: tI + 0.14, x: V.x, y: V.y - ht(V) * 0.5, reaction: 'shatter' };
}

/** 퀸 — 연속 베기: 회전 → 잉크로 순간이동 → 3연격 → 등 돌린 정적 */
function slash(d: Duel, t: number): Hit {
  const { tl, A, V, dir, w } = d;
  const sX = V.x - dir * 95;
  const sp = { v: 0 };
  tl.to(sp, { v: 2, duration: 0.45, ease: 'power2.in', onUpdate: () => { A.sx = Math.cos(sp.v * Math.PI * 2); } }, t);
  const ribbon = w.strokes.ring({ x: sX, y: V.y - 45, r: 0, w: 2.5, squash: 0.32, kind: 'spiral', alpha: 0 });
  tl.to(ribbon, { r: 52, alpha: 0.9, spin: 12, duration: 0.45, ease: 'power2.in' }, t);
  tl.call(() => sfx.whoosh(), [], t + 0.1);
  const tB = t + 0.47;
  tl.to(ribbon, { alpha: 0, duration: 0.08 }, tB);
  tl.call(() => { w.drops.spray(A.x, A.y - 50, -Math.PI / 2, 1.6, 14, 420, d.ground, 0.8, 0.6); }, [], tB);
  tl.to(A, { alpha: 0, duration: 0.04 }, tB);
  tl.set(A, { x: V.x - dir * 52, sx: 1 }, tB + 0.07);
  tl.to(A, { alpha: 1, duration: 0.06 }, tB + 0.09);
  tl.call(() => { w.drops.spray(A.x, A.y - 50, -Math.PI / 2, 1.6, 10, 380, d.ground, 0.8, 0.6); sfx.splat(); }, [], tB + 0.09);
  const cx = V.x;
  const cy = V.y - ht(V) * 0.5;
  const angs = [-30, 25, 0];
  const L = 100;
  let tLast = 0;
  const marks: ReturnType<typeof quill>[] = [];
  angs.forEach((deg, k) => {
    const a = rad(deg);
    const ux = Math.cos(a) * dir;
    const uy = Math.sin(a);
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8 - 0.5;
      const bulge = Math.sin((u + 0.5) * Math.PI) * 9;
      pts.push([cx + ux * u * L - uy * bulge, cy + uy * u * L + ux * bulge * 0.3]);
    }
    const big = k === 2;
    const ts = tB + 0.24 + k * 0.17;
    const s = quill(d, pts, ts, 0.07, { w: big ? 12 : 7, taper: 'spindle', ease: 'power2.in' });
    marks.push(s);
    impact(d, ts + 0.07, cx, cy, { stop: big ? 0.12 : 0.05, shake: big ? 7 : 2.5, spray: big ? 18 : 7, ang: fwdAng(dir, 0.2), sound: () => sfx.slash(big), flash: big ? 0.6 : 0.25, size: big ? 70 : 40 });
    if (!big) {
      quill(d, [[-ux * 30, -ht(V) * 0.5 - uy * 30], [ux * 30, -ht(V) * 0.5 + uy * 30]], ts + 0.07, 0.01, { parent: V, w: 1.4, showQuill: false });
      tl.to(V, { rot: rad(dir * (k ? -3 : 3)), duration: 0.05, yoyo: true, repeat: 1 }, ts + 0.13);
    }
    tLast = ts + 0.07 + (big ? 0.12 : 0.05);
  });
  tl.to(A, { x: V.x + dir * 72, duration: 0.1, ease: 'power3.out' }, tLast - 0.12);
  marks.forEach((s) => dry(d, s, tLast + 0.35, 0.45));
  return { t: tLast + 0.02, x: cx, y: cy, reaction: 'split', cutAng: 0, cutY: -ht(V) * 0.5 };
}

/** 킹 — 일도양단: 깃펜이 대검을 그리고, 긴 예비 동작 끝에 한 칼 */
function cleave(d: Duel, t: number): Hit {
  const { tl, A, V, dir, w } = d;
  const sX = V.x - dir * 95;
  tl.to(A, { x: sX + dir * 14, duration: 0.3, ease: 'power1.inOut' }, t);
  tl.to(A, { lift: 8, duration: 0.15, yoyo: true, repeat: 1, ease: 'sine.out' }, t);
  const sw: Anchor = { x: sX - dir * 4, y: V.y - ht(A) - 34, rot: 0 };
  const Lb = 118;
  const blade: ReturnType<typeof quill>[] = [
    quill(d, [[0, -Lb], [-7, -Lb + 18], [-7, -4]], t + 0.3, 0.24, { parent: sw, w: 2.6, taper: 'flat' }),
    quill(d, [[0, -Lb], [7, -Lb + 18], [7, -4]], t + 0.3, 0.24, { parent: sw, w: 2.6, taper: 'flat', showQuill: false }),
    quill(d, [[0, -Lb + 24], [0, -10]], t + 0.54, 0.08, { parent: sw, w: 1.6, taper: 'spindle' }),
    quill(d, [[-25, 0], [25, 0]], t + 0.62, 0.07, { parent: sw, w: 5, taper: 'spindle' }),
    quill(d, [[0, 3], [0, 22]], t + 0.69, 0.06, { parent: sw, w: 5, taper: 'flat' }),
    quill(d, [[-4, 26], [0, 30], [4, 26], [0, 23], [-4, 26]], t + 0.75, 0.05, { parent: sw, w: 2.4, taper: 'flat' }),
  ];
  tl.to(sw, { y: sw.y - 6, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t + 0.35);
  const tA = t + 0.85;
  const ax = V.x - dir * 6;
  const ay = V.y - 152;
  tl.to(sw, { x: ax, y: ay, rot: rad(-dir * 38), duration: 0.42, ease: 'power2.out' }, tA);
  edge(d, A, -dir, tA);
  tl.to(A, { rot: rad(-dir * 8), duration: 0.38, ease: 'power2.out' }, tA);
  tl.to(w.cam, { rot: rad(dir * 4), zoom: DUEL.zoom * 1.04, cy: V.y - 100, duration: 0.55, ease: 'sine.inOut' }, tA);
  tl.call(() => sfx.swell(), [], tA);
  const tS = tA + 0.62;
  tl.to(sw, { rot: rad(dir * 180), duration: 0.075, ease: 'power3.in' }, tS);
  const arc: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const th = rad(-dir * 38) + ((rad(dir * 180) - rad(-dir * 38)) * i) / 16;
    arc.push([ax + Math.sin(th) * (Lb - 8), ay - Math.cos(th) * (Lb - 8)]);
  }
  const swoosh = quill(d, arc, tS, 0.075, { w: 24, dry: 0.75, taper: 'spindle', showQuill: false, alpha: 0.55, ease: 'power3.in' });
  tl.to(A, { rot: rad(dir * 5), duration: 0.08 }, tS);
  const tI = tS + 0.075;
  impact(d, tI, V.x, V.y - ht(V) * 0.55, { stop: 0.17, shake: 10, spray: 30, ang: -Math.PI / 2 + dir * 0.6, spread: 1.1, flash: 0.95, sound: () => { sfx.slash(true); sfx.thud(0.8); }, size: 90 });
  tl.set(w.flash, { a: 0.85, ink: true }, tI + 0.03);
  tl.set(w.flash, { ink: false, a: 0.3 }, tI + 0.065);
  tl.to(sw, { y: ay + 16, duration: 0.12, ease: 'power2.out' }, tI + 0.17);
  tl.call(() => { for (let i = 0; i < 7; i++) w.drops.drip(V.x + rand(-6, 6), ay + rand(10, 100), d.ground + rand(-3, 12)); }, [], tI + 0.45);
  blade.forEach((s) => dry(d, s, tI + 0.5, 0.55));
  dry(d, swoosh, tI + 0.2, 0.45);
  tl.to(w.cam, { rot: 0, zoom: DUEL.zoom, cy: V.y - 48, duration: 0.45, ease: 'power2.inOut' }, tI + 0.3);
  tl.to(A, { rot: 0, duration: 0.35, ease: 'elastic.out(1,0.5)' }, tI + 0.25);
  return { t: tI + 0.17, x: V.x, y: V.y - ht(V) * 0.55, reaction: 'split', cutAng: Math.PI / 2, cutY: -ht(V) * 0.5 };
}

export const ATTACKS: Record<PieceType, (d: Duel, t: number) => Hit> = {
  p: pierce, n: charge, b: magic, r: crush, q: slash, k: cleave,
};
