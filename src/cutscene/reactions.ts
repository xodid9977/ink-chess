// 피격 리액션 5종: 꿰뚫림 / 날아감 / 녹아내림 / 산산조각 / 두 동강
import { DUEL } from '../config';
import { sfx } from '../audio/sfx';
import type { Frag } from '../fx/fragments';
import { rad, rand } from '../util/noise';
import { bh, edge, ht, quill, type Duel, type Hit, type Reaction } from './common';

function pierced(d: Duel, h: Hit): number {
  const { tl, V, dir, w } = d;
  const t = h.t;
  const blot = { lx: 0, ly: h.y - V.y, r: 0, a: 0.85 };
  V.blots.push(blot);
  tl.to(blot, { r: 30, duration: 0.5, ease: 'power2.out' }, t);
  tl.to(V, { x: V.x + dir * 10, duration: 0.08, ease: 'power2.out' }, t);
  edge(d, V, dir, t + 0.1);
  tl.to(V, { rot: rad(dir * 90), duration: 0.55, ease: 'bounce.out' }, t + 0.14);
  tl.call(() => { sfx.thud(0.7); w.drops.spray(V.x + dir * ht(V) * 0.6, V.y - 4, -Math.PI / 2, 1.2, 8, 300, d.ground + 4, 0.8, 0.6); }, [], t + 0.42);
  tl.to(blot, { r: 90, a: 0.95, duration: 0.6, ease: 'power1.in' }, t + 0.65);
  tl.call(() => w.drops.stain(V.x + dir * ht(V) * 0.5, V.y + 3, ht(V) * 0.6, { a: 0.55, persist: DUEL.battleStainAlpha, grow: 0.7, hold: 0.5, fade: 1.4 }), [], t + 0.7);
  tl.to(V, { alpha: 0, duration: 0.5, ease: 'power1.in' }, t + 0.8);
  return t + 1.35;
}

function knockback(d: Duel, h: Hit): number {
  const { tl, V, dir, w } = d;
  const t = h.t;
  tl.set(V, { pvx: 0, pvy: -ht(V) * 0.5, rot: 0 }, t);
  const trail = (): void => {
    if (Math.random() < 0.45) w.drops.drip(V.x, V.y - V.lift - ht(V) * 0.5, d.ground + rand(0, 40), 1.1);
  };
  tl.to(V, { x: V.x + dir * 640, duration: 0.55, ease: 'power1.in', onUpdate: trail }, t);
  tl.to(V, { lift: 320, duration: 0.55, ease: 'power2.out' }, t);
  tl.to(V, { rot: rad(dir * 560), sx: 1.45, sy: 1.45, duration: 0.55, ease: 'power1.in' }, t);
  tl.set(V, { visible: false }, t + 0.56);
  tl.call(() => {
    sfx.thud(0.45);
    const x = w.cam.cx + dir * w.viewW() * 0.4;
    w.drops.stain(x, d.ground + 30, 26, { a: 0.65, persist: 0.08, grow: 0.15 });
    w.drops.spray(x, d.ground + 25, -Math.PI / 2, 1.2, 9, 420, d.ground + 45, 0.8, 0.5);
  }, [], t + 0.85);
  return t + 1.15;
}

function dissolve(d: Duel, h: Hit): number {
  const { tl, V, w } = d;
  const t = h.t;
  tl.to(V, { dissolve: 1, duration: 1.0, ease: 'power1.in' }, t);
  for (let k = 0; k < 8; k++) {
    tl.call(() => w.drops.drip(V.x + rand(-24, 24), V.y - rand(0, ht(V) * 0.6), d.ground + rand(-4, 16), 1.2), [], t + 0.1 + k * 0.1);
  }
  for (const k of [0.2, 0.45, 0.7]) tl.call(() => sfx.drip(), [], t + k);
  tl.call(() => w.drops.stain(V.x, V.y + 3, 54, { a: 0.5, persist: DUEL.battleStainAlpha, grow: 0.9, hold: 0.5, fade: 1.6 }), [], t + 0.25);
  tl.set(V, { visible: false }, t + 1.0);
  return t + 1.1;
}

function shatter(d: Duel, h: Hit): number {
  const { tl, V, w } = d;
  const t = h.t;
  const H = ht(V);
  for (let i = 0; i < 4; i++) {
    const a = rad(60 + i * 20);
    quill(d, [[0, -H * 0.85], [Math.cos(a) * 8 * (i - 1.5), -H * 0.6], [Math.cos(a) * 18 * (i - 1.5), -H * 0.3]], t, 0.07, { parent: V, w: 2, taper: 'out', showQuill: false });
  }
  const shards = w.frags.shatter(V, 0, -H * 0.55, 9);
  tl.call(() => {
    shards.forEach((f) => { f.visible = true; f.x = V.x; f.y = V.y - V.lift; });
    V.visible = false;
    w.drops.spray(V.x, V.y - H * 0.5, -Math.PI / 2, 1.4, 16, 700, d.ground, 1, 0.8);
  }, [], t + 0.08);
  return t + 1.3;
}

function split(d: Duel, h: Hit): number {
  const { tl, V, dir, w } = d;
  const t = h.t;
  const ang = h.cutAng ?? 0;
  const cy = h.cutY ?? -ht(V) * 0.5;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  // 베인 선: 종이색 틈
  quill(d, [[-ux * 50, cy - uy * 50], [ux * 50, cy + uy * 50]], t, 0.04, { parent: V, w: 2.6, paper: true, showQuill: false });
  const [up, dn] = w.frags.split(V, ang, 0, cy);
  const t1 = t + 0.17; // 베인 걸 깨닫는 정적
  tl.call(() => {
    [up, dn].forEach((f) => { f.visible = true; f.x = V.x; f.y = V.y - V.lift; f.rot = V.rot; });
    V.visible = false;
    sfx.splat();
  }, [], t1);
  const horizontal = Math.abs(ux) > 0.7;
  const fall = (f: Frag, props: gsap.TweenVars, at: number): void => { tl.to(f, props, at); };
  if (horizontal) {
    tl.set(up, { pvx: 0, pvy: cy }, t1);
    fall(up, { x: V.x + dir * 40, rot: rad(dir * 30), duration: 0.45, ease: 'power2.in' }, t1);
    fall(up, { y: V.y - cy * 0.9, duration: 0.3, ease: 'power2.in' }, t1 + 0.3);
    fall(up, { rot: rad(dir * 85), duration: 0.25, ease: 'bounce.out' }, t1 + 0.45);
    tl.set(dn, { pvx: -dir * bh(V), pvy: 0 }, t1);
    fall(dn, { rot: rad(-dir * 6), duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t1 + 0.08);
  } else {
    const upSide = up.clip.reduce((s, p) => s + p[0], 0) > 0 ? 1 : -1;
    tl.set(up, { pvx: upSide * bh(V), pvy: 0 }, t1);
    tl.set(dn, { pvx: -upSide * bh(V), pvy: 0 }, t1);
    fall(up, { x: V.x + upSide * 10, rot: rad(upSide * 24), duration: 0.4, ease: 'power2.in' }, t1);
    fall(dn, { x: V.x - upSide * 10, rot: rad(-upSide * 24), duration: 0.4, ease: 'power2.in' }, t1);
    fall(up, { rot: rad(upSide * 88), duration: 0.3, ease: 'bounce.out' }, t1 + 0.4);
    fall(dn, { rot: rad(-upSide * 88), duration: 0.3, ease: 'bounce.out' }, t1 + 0.4);
  }
  tl.call(() => sfx.thud(0.6), [], t1 + 0.62);
  // 잘린 단면에서 잉크가 번져 나옴 (피 대신 먹)
  for (let k = 0; k < 6; k++) {
    tl.call(() => {
      for (let i = 0; i < 3; i++) {
        const s = rand(-40, 40);
        w.drops.spray(V.x + ux * s, V.y + cy + uy * s, Math.PI / 2 + rand(-0.6, 0.6), 0.4, 1, 260, d.ground + rand(-2, 14), 1.1, 1);
      }
    }, [], t1 + 0.02 + k * 0.07);
  }
  tl.call(() => w.drops.stain(V.x + dir * 20, V.y + 3, 58, { a: 0.55, persist: DUEL.battleStainAlpha, grow: 0.8, hold: 0.5, fade: 1.5 }), [], t1 + 0.6);
  tl.to([up, dn], { alpha: 0, duration: 0.5, ease: 'power1.in' }, t1 + 1.0);
  return t1 + 1.35;
}

export const REACTIONS: Record<Reaction, (d: Duel, h: Hit) => number> = { pierced, knockback, dissolve, shatter, split };
