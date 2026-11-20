// 결투 감독: 접근 → 줌인·물로 씻기 → 대치 → 공격 → 리액션 → 복귀. 언제든 스킵 가능
import gsap from 'gsap';
import { DUEL, type DuelMode } from '../config';
import { sfx } from '../audio/sfx';
import type { PieceEnt } from '../render/entity';
import { HOME, type World } from '../render/world';
import { rad } from '../util/noise';
import { ATTACKS } from './attacks';
import { edge, ht, tickBursts, type Duel } from './common';
import { REACTIONS } from './reactions';

export { tickBursts };

export interface DuelRun { done: Promise<void>; skip: () => void }

const faceFlip = (p: PieceEnt, face: number): 1 | -1 => (p.type === 'n' ? (face > 0 ? -1 : 1) : 1);

export function playDuel(w: World, A: PieceEnt, V: PieceEnt, destX: number, destY: number, mode: DuelMode): DuelRun {
  gsap.killTweensOf([A, V]);
  Object.assign(A, { rot: 0, pvx: 0, pvy: 0, sx: 1, sy: 1, lift: 0, alpha: 1 });
  const tl = gsap.timeline({ paused: true });
  if (mode === 'off') return quick(w, tl, A, V, destX, destY);
  const side = A.x < V.x - 1 ? -1 : A.x > V.x + 1 ? 1 : A.color === 'w' ? -1 : 1;
  const dir = (-side) as 1 | -1;
  const d: Duel = { tl, w, A, V, dir, ground: V.y + 4 };
  A.focus = true;
  V.focus = true;
  A.flip = faceFlip(A, dir);
  V.flip = faceFlip(V, -dir);
  const sX = V.x - dir * DUEL.standGap;

  // [0] 접근
  tl.set(A, { ghost: true }, 0);
  tl.to(A, { x: sX, y: V.y, duration: 0.42, ease: 'power2.inOut' }, 0);
  tl.to(A, { lift: 16, duration: 0.21, yoyo: true, repeat: 1, ease: 'sine.out' }, 0);
  tl.set(A, { ghost: false }, 0.42);
  // [1] 줌인 + 주변이 물에 씻기듯 지워짐
  const mx = (sX + V.x) / 2;
  const my = V.y - 48;
  tl.call(() => sfx.page(), [], 0.2);
  tl.set(w.wash, { x: mx, y: my + 20, r: 0, a: 0.88 }, 0.2);
  tl.to(w.wash, { r: 950, duration: 0.75, ease: 'power2.out' }, 0.22);
  tl.to(w.cam, { cx: mx, cy: my, zoom: DUEL.zoom, rot: 0, duration: 0.62, ease: 'power3.inOut' }, 0.2);
  tl.to(w, { vignette: 1, duration: 0.5 }, 0.3);
  // [2] 대치: 피해자는 움찔, 공격자는 숨 고르기
  edge(d, V, dir, 0.8);
  tl.to(V, { rot: rad(dir * 3.5), duration: 0.2, ease: 'power2.out' }, 0.82);
  tl.to(V, { rot: 0, duration: 0.18, ease: 'sine.inOut' }, 1.14);
  edge(d, A, -dir, 0.8);
  tl.to(A, { rot: rad(-dir * 2), duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.82);
  tl.set(A, { rot: 0 }, 1.3);
  // [3][4] 공격 + 리액션
  const hit = ATTACKS[A.type](d, 1.32);
  const tE = REACTIONS[hit.reaction](d, hit) + 0.05;
  // [5][6] 복귀: 씻겨 나간 보드가 돌아오고 공격자는 목표 칸에 착지
  tl.to(w.wash, { r: 0, a: 0, duration: 0.5, ease: 'power2.in' }, tE);
  tl.to(w.cam, { ...HOME, duration: 0.6, ease: 'power3.inOut' }, tE);
  tl.to(w, { vignette: 0, duration: 0.45 }, tE);
  tl.set(A, { rot: 0, pvx: 0, pvy: 0, sx: 1, sy: 1, alpha: 1, ghost: false }, tE);
  tl.to(A, { x: destX, y: destY, duration: 0.42, ease: 'power2.inOut' }, tE + 0.12);
  tl.to(A, { lift: 14, duration: 0.21, yoyo: true, repeat: 1, ease: 'sine.out' }, tE + 0.12);
  tl.call(() => {
    A.flip = 1;
    A.focus = false;
    w.drops.stain(destX, destY + 3, 30, { a: 0.4, persist: DUEL.battleStainAlpha * 0.6, grow: 0.25 });
    sfx.thud(0.5);
  }, [], tE + 0.55);
  tl.set({}, {}, tE + 0.6);
  if (mode === 'short') tl.timeScale(1.75);
  return run(w, tl, A, V, destX, destY);
}

/** 컷신 끔: 보드 위에서 짧게 */
function quick(w: World, tl: gsap.core.Timeline, A: PieceEnt, V: PieceEnt, destX: number, destY: number): DuelRun {
  tl.to(A, { x: destX, y: destY, duration: 0.3, ease: 'power2.in' }, 0);
  tl.call(() => {
    sfx.splat();
    w.drops.spray(V.x, V.y - ht(V) * 0.5, -Math.PI / 2, 1.3, 12, 500, V.y + 4, 0.9, 0.7);
    w.drops.stain(V.x, V.y + 3, 34, { a: 0.5, persist: DUEL.battleStainAlpha, grow: 0.4 });
  }, [], 0.26);
  tl.to(V, { dissolve: 1, duration: 0.35 }, 0.26);
  tl.set(V, { visible: false }, 0.62);
  return run(w, tl, A, V, destX, destY);
}

function run(w: World, tl: gsap.core.Timeline, A: PieceEnt, V: PieceEnt, destX: number, destY: number): DuelRun {
  let finished = false;
  const done = new Promise<void>((resolve) => {
    tl.eventCallback('onComplete', () => {
      finished = true;
      Object.assign(A, { x: destX, y: destY, focus: false, flip: 1, rot: 0, pvx: 0, pvy: 0, sx: 1, sy: 1, lift: 0, alpha: 1, ghost: false });
      V.visible = false;
      V.focus = false;
      w.fxScale = 1;
      resolve();
    });
  });
  tl.play();
  return {
    done,
    skip: () => {
      if (finished) return;
      tl.timeScale(1);
      tl.progress(1);
      w.clearTransient();
      w.flash.a = 0;
      Object.assign(w.cam, HOME);
      w.wash.a = 0;
      w.vignette = 0;
    },
  };
}
