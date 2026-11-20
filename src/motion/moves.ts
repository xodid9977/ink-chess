// 보드 위 이동: 종이 위를 '스르륵' 미끄러지는 글라이드
import gsap from 'gsap';
import { S } from '../config';
import { sfx } from '../audio/sfx';
import type { PieceEnt } from '../render/entity';
import type { World } from '../render/world';
import { rad, type Pt } from '../util/noise';
import { GEOM } from '../render/shapes';

const play = (tl: gsap.core.Timeline): Promise<void> => new Promise((r) => { tl.eventCallback('onComplete', () => r()); tl.play(); });

/** 받침 모서리에 회전축 두기. side: +1 오른쪽 모서리 */
export function pivotEdge(p: PieceEnt, side: number): void {
  p.pvx = side * GEOM[p.type].baseHalf * S;
  p.pvy = 0;
}

export function land(w: World, p: PieceEnt, big = false): void {
  w.drops.stain(p.x, p.y + 2, big ? 24 : 16, { a: 0.22, persist: 0, grow: 0.3, hold: 0.25, fade: 0.9 });
  sfx.tap();
}

/** 선택: 확실히 떠올라 숨 쉬듯 위아래로 흔들림 / 해제: 내려앉음 */
export function selectLift(p: PieceEnt, on: boolean): void {
  gsap.killTweensOf(p, 'lift,rot');
  p.pvx = 0;
  if (!on) { gsap.to(p, { lift: 0, rot: 0, duration: 0.28, ease: 'power2.inOut' }); return; }
  gsap.timeline()
    .to(p, { lift: 18, rot: rad(-3), duration: 0.26, ease: 'back.out(1.8)' })
    .to(p, { lift: 13, duration: 0.75, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

/** 지나간 자리에 남는 옅은 먹 자국 */
function trail(w: World, tl: gsap.core.Timeline, pts: Pt[], dur: number, at = 0): void {
  const s = w.strokes.add({ pts, w: 2.2, taper: 'spindle', alpha: 0.22, quill: false, dry: 0.35 });
  tl.to(s, { progress: 1, duration: dur, ease: 'power2.inOut' }, at);
  tl.to(s, { alpha: 0, duration: 1.4, ease: 'power1.in' }, at + dur + 0.2);
}

/** 한 칸 위를 미끄러지기: 출발할 때 진행 방향으로 살짝 기울고, 도착하면 관성으로 흔들리다 멈춤 */
export function animateMove(w: World, p: PieceEnt, tx: number, ty: number): Promise<void> {
  gsap.killTweensOf(p);
  const sx = p.x;
  const sy = p.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const lean = Math.sign(dx) || (dy < 0 ? 1 : -1);
  const dist = Math.hypot(dx, dy) / S;
  const dur = Math.min(0.85, 0.34 + dist * 0.075);
  const tl = gsap.timeline({ paused: true });
  p.pvx = 0;
  p.pvy = 0;
  tl.call(() => sfx.slide(dur + 0.1), [], 0);
  tl.to(p, { lift: 3, duration: 0.1, ease: 'sine.out' }, 0);
  if (p.type === 'n') {
    // 나이트: L자를 따라 꺾어 미끄러짐
    const long = Math.abs(dx) > Math.abs(dy);
    const cx = long ? tx : sx;
    const cy = long ? sy : ty;
    trail(w, tl, [[sx, sy + 2], [cx, cy + 2], [tx, ty + 2]], dur);
    tl.to(p, { x: cx, y: cy, duration: dur * 0.58, ease: 'power2.in' }, 0.04);
    tl.to(p, { x: tx, y: ty, duration: dur * 0.42, ease: 'power2.out' }, 0.04 + dur * 0.58);
    tl.to(p, { rot: rad(lean * 5), duration: dur * 0.5, ease: 'sine.out' }, 0.04);
  } else {
    trail(w, tl, [[sx, sy + 2], [tx, ty + 2]], dur);
    tl.to(p, { x: tx, y: ty, duration: dur, ease: 'power2.inOut' }, 0.04);
    tl.to(p, { rot: rad(lean * 4), duration: dur * 0.45, ease: 'sine.out' }, 0.04);
  }
  // 도착: 관성으로 반대로 살짝 → 진동하며 정착
  tl.to(p, { rot: rad(-lean * 2.5), duration: dur * 0.4, ease: 'sine.inOut' }, 0.04 + dur * 0.6);
  tl.to(p, { lift: 0, duration: 0.14, ease: 'sine.in' }, dur - 0.08);
  tl.call(() => land(w, p, p.type === 'r' || p.type === 'k'), [], dur + 0.04);
  tl.to(p, { rot: 0, duration: 0.45, ease: 'elastic.out(1,0.45)' }, dur + 0.04);
  tl.set(p, { pvx: 0, pvy: 0, rot: 0, sx: 1, sy: 1, lift: 0 });
  return play(tl);
}

/** 갈 수 없는 칸: 스르륵 가다가 막혀서 → 스르륵 되돌아옴 */
export function illegalBounce(w: World, p: PieceEnt, homeX: number, homeY: number, tx: number, ty: number): Promise<void> {
  gsap.killTweensOf(p);
  const dragged = Math.hypot(p.x - homeX, p.y - homeY) > 10;
  const bx = dragged ? p.x : homeX + (tx - homeX) * 0.42;
  const by = dragged ? p.y : homeY + (ty - homeY) * 0.42;
  const lean = Math.sign(tx - homeX) || 1;
  const tl = gsap.timeline({ paused: true });
  p.pvx = 0;
  if (!dragged) {
    tl.call(() => sfx.slide(0.3), [], 0);
    tl.to(p, { x: bx, y: by, lift: 3, rot: rad(lean * 4), duration: 0.32, ease: 'power2.out' });
  }
  tl.call(() => {
    sfx.bonk();
    const ix = bx + (tx - homeX) * 0.1;
    w.drops.stain(ix, by + 3, 20, { a: 0.3, persist: 0, grow: 0.2, hold: 0.4, fade: 1.2 });
    w.drops.spray(ix, by - 25, Math.atan2(homeY - ty, homeX - tx), 0.8, 5, 200, by + 4, 0.6, 0.4);
  })
    .to(p, { sx: 0.95, sy: 1.03, duration: 0.06, yoyo: true, repeat: 1 }, '+=0.02')
    .to(p, { rot: rad(-lean * 5), duration: 0.12, ease: 'power2.out' }, '<')
    .call(() => sfx.slide(0.45))
    .to(p, { x: homeX, y: homeY, lift: 0, duration: 0.5, ease: 'power2.inOut' })
    .to(p, { rot: rad(lean * 2), duration: 0.3, ease: 'sine.inOut' }, '<0.1')
    .to(p, { rot: rad(-4), duration: 0.09, ease: 'sine.inOut' })
    .to(p, { rot: rad(4), duration: 0.12, ease: 'sine.inOut' })
    .to(p, { rot: 0, duration: 0.3, ease: 'elastic.out(1,0.5)' })
    .set(p, { sx: 1, sy: 1, lift: 0, rot: 0 });
  return play(tl);
}

/** 여러 말을 동시에 미끄러뜨리기 (판 뒤집기 등) */
export function glideAll(moves: { p: PieceEnt; x: number; y: number }[], dur = 0.7): Promise<void> {
  const tl = gsap.timeline({ paused: true });
  tl.call(() => sfx.slide(dur), [], 0);
  moves.forEach(({ p, x, y }, i) => tl.to(p, { x, y, duration: dur, ease: 'power2.inOut' }, i * 0.012));
  return play(tl);
}

/** 게임 시작: 펜으로 그려지며 등장 */
export function drawIn(pieces: PieceEnt[]): Promise<void> {
  const tl = gsap.timeline({ paused: true });
  pieces.forEach((p, i) => {
    p.reveal = 0;
    tl.to(p, { reveal: 1, duration: 0.42, ease: 'power1.inOut' }, i * 0.035);
  });
  tl.call(() => sfx.scratch(), [], 0);
  return play(tl);
}

/** 판 엎기: 말들이 잉크로 녹아 사라짐 */
export function washAway(pieces: PieceEnt[]): Promise<void> {
  const tl = gsap.timeline({ paused: true });
  pieces.forEach((p, i) => tl.to(p, { dissolve: 1, duration: 0.5, ease: 'power1.in' }, i * 0.018));
  tl.call(() => sfx.page(), [], 0);
  return play(tl);
}
