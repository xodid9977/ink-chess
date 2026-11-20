// 승급(변신): 병사가 떠올라 잉크 소용돌이에 녹고, 깃펜이 새 말을 다시 그린다
import gsap from 'gsap';
import { sfx } from '../audio/sfx';
import type { PieceEnt } from '../render/entity';
import type { PieceType } from '../render/shapes';
import { HOME, type World } from '../render/world';
import { rad, rand, type Pt } from '../util/noise';

export function promoteAnim(w: World, p: PieceEnt, to: PieceType): Promise<void> {
  return new Promise((done) => {
    const tl = gsap.timeline({ onComplete: () => done() });
    const cx = p.x;
    const cy = p.y;
    p.focus = true;
    p.pvx = 0;
    p.pvy = -30;
    // 1) 카메라가 다가가고 주변이 옅어짐
    tl.to(w.cam, { cx, cy: cy - 60, zoom: 2.2, duration: 0.6, ease: 'power3.inOut' }, 0);
    tl.set(w.wash, { x: cx, y: cy - 40, r: 0, a: 0.75 }, 0);
    tl.to(w.wash, { r: 520, duration: 0.7, ease: 'power2.out' }, 0.05);
    tl.to(w, { vignette: 0.8, duration: 0.5 }, 0.1);
    tl.call(() => sfx.magic(), [], 0.2);
    // 2) 발밑에 깃펜이 고리를 그림
    const ring: Pt[] = [];
    for (let i = 0; i <= 46; i++) {
      const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
      ring.push([cx + Math.cos(a) * 46, cy + 2 + Math.sin(a) * 14]);
    }
    const sig = w.strokes.add({ pts: ring, w: 2.4, taper: 'flat', quill: true });
    tl.to(sig, { progress: 1, duration: 0.5, ease: 'power1.inOut' }, 0.3);
    // 3) 병사가 떠오르며 떨고, 잉크 소용돌이가 감쌈
    tl.to(p, { lift: 36, duration: 0.7, ease: 'sine.inOut' }, 0.55);
    tl.to(p, { rot: rad(3), duration: 0.05, yoyo: true, repeat: 9, ease: 'none' }, 0.75);
    const swirl = w.strokes.ring({ x: cx, y: cy - 70, r: 0, w: 3, squash: 0.45, kind: 'spiral', alpha: 0 });
    tl.to(swirl, { r: 58, alpha: 1, spin: 14, duration: 0.8, ease: 'power2.in' }, 0.7);
    for (const k of [0.8, 0.95, 1.1, 1.25]) {
      tl.call(() => w.drops.spray(cx + rand(-30, 30), cy - 10, -Math.PI / 2 + rand(-0.4, 0.4), 0.3, 3, 380, cy + 4, 0.6, 0.3), [], k);
    }
    // 4) 잉크로 녹아 사라짐 → 번쩍 → 새 모습
    tl.to(p, { dissolve: 1, duration: 0.4, ease: 'power1.in' }, 1.15);
    const tF = 1.55;
    tl.call(() => {
      p.type = to;
      p.dissolve = 0;
      p.reveal = 0;
      p.rot = 0;
      w.flash.a = 0.75;
      w.flash.ink = false;
      w.drops.spray(cx, cy - 60, -Math.PI / 2, Math.PI, 22, 620, cy + 6, 1, 0.7);
      sfx.scratch();
    }, [], tF);
    const burst = w.strokes.ring({ x: cx, y: cy - 55, r: 10, w: 4, squash: 0.85 });
    tl.to(burst, { r: 95, alpha: 0, w: 1, duration: 0.5, ease: 'power2.out' }, tF);
    tl.to(swirl, { alpha: 0, r: 80, duration: 0.3 }, tF);
    // 5) 깃펜이 아래에서부터 새 말을 그림
    tl.to(p, { reveal: 1, duration: 0.75, ease: 'power1.inOut' }, tF + 0.05);
    tl.call(() => sfx.scratch(), [], tF + 0.4);
    // 6) 내려앉음
    tl.to(p, { lift: 0, duration: 0.35, ease: 'bounce.out' }, tF + 0.85);
    tl.call(() => { sfx.thud(0.7); w.shake(3); w.drops.stain(cx, cy + 3, 34, { a: 0.4, persist: 0.1, grow: 0.3 }); }, [], tF + 1.0);
    tl.to(sig, { alpha: 0, duration: 0.6 }, tF + 0.9);
    // 7) 카메라 복귀
    tl.to(w.wash, { r: 0, a: 0, duration: 0.5, ease: 'power2.in' }, tF + 1.15);
    tl.to(w.cam, { ...HOME, duration: 0.6, ease: 'power3.inOut' }, tF + 1.15);
    tl.to(w, { vignette: 0, duration: 0.45 }, tF + 1.15);
    tl.set(p, { focus: false, pvy: 0, rot: 0 }, tF + 1.75);
  });
}
