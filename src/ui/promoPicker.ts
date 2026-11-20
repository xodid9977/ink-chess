// 승급 고르기 창: 잉크로 그린 퀸·룩·비숍·나이트 중 하나를 누른다 (키보드 Q R B N도 가능)
import { sfx } from '../audio/sfx';
import { getArt } from '../render/pieceArt';
import type { Color, PieceType } from '../render/shapes';
import { $ } from './panel';

const CHOICES: { t: PieceType; name: string; key: string }[] = [
  { t: 'q', name: '퀸', key: 'q' },
  { t: 'r', name: '룩', key: 'r' },
  { t: 'b', name: '비숍', key: 'b' },
  { t: 'n', name: '나이트', key: 'n' },
];

export function pickPromotion(color: Color): Promise<PieceType> {
  return new Promise((resolve) => {
    const box = $('promo');
    const row = $('promo-row');
    row.innerHTML = '';
    const finish = (t: PieceType): void => {
      window.removeEventListener('keydown', onKey);
      sfx.tap();
      box.classList.add('leaving');
      window.setTimeout(() => { box.hidden = true; box.classList.remove('leaving'); }, 350);
      resolve(t);
    };
    const onKey = (e: KeyboardEvent): void => {
      const c = CHOICES.find((x) => x.key === e.key.toLowerCase());
      if (c) finish(c.t);
    };
    CHOICES.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.animationDelay = `${i * 90}ms`;
      const art = getArt(c.t, color);
      const cv = document.createElement('canvas');
      cv.width = Math.round(art.w * 0.5);
      cv.height = Math.round(art.h * 0.5);
      cv.getContext('2d')?.drawImage(art.frames[0], 0, 0, cv.width, cv.height);
      const label = document.createElement('span');
      label.textContent = c.name;
      b.append(cv, label);
      b.setAttribute('aria-label', `${c.name}(으)로 변신`);
      b.addEventListener('click', () => finish(c.t));
      row.appendChild(b);
    });
    box.hidden = false;
    window.addEventListener('keydown', onKey);
    (row.firstElementChild as HTMLButtonElement | null)?.focus();
    sfx.page();
  });
}
