// 일기장 쪽 화면: 한 글자씩 써지는 해설, 차례 표시
import type { IllegalReason } from '../core/game';
import { sfx } from '../audio/sfx';
import { InkText } from './inkText';

export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} 없음`);
  return el as T;
};

const inks = new Map<string, InkText>();
/** 일기장에 잉크가 모여 써지는 문장 (target: 상자 id) */
export function write(target: string, text: string, keep = 4): void {
  let it = inks.get(target);
  if (!it) {
    const el = $(target);
    it = new InkText(el, keep, el.dataset.align === 'top' ? 'top' : 'bottom');
    inks.set(target, it);
  }
  it.write(text);
  // 화면 낭독기용 텍스트
  $(target).setAttribute('aria-label', text);
  sfx.scratch();
}

export function wipe(target: string): void {
  inks.get(target)?.clear();
}

export const diary = (text: string): void => write('diary', text, 7);

let lastTurn = '';
/** 차례 표시도 잉크로 (바뀔 때만 새로 씀) */
export function setTurn(text: string): void {
  if (text === lastTurn) return;
  lastTurn = text;
  write('turn', text, 1);
}

const ILLEGAL: Record<IllegalReason, string[]> = {
  notYourTurn: ['아직 네 차례가 아니다.', '기다려라. 상대의 펜이 움직일 차례다.'],
  pattern: ['그 말은 그렇게 움직이지 않는다.', '그 길은 이 말의 길이 아니다.', '…그건 규칙에 없는 걸음이다.'],
  blocked: ['그 길은 막혀 있다.', '가로막는 말이 있다.'],
  ownPiece: ['제 편을 밟을 수는 없다.'],
  pinned: ['그 말은 움직일 수 없다. 왕을 지키고 있다.', '움직이면 왕이 드러난다.'],
  inCheck: ['왕이 위험하다…', '먼저 왕을 지켜라.'],
  kingDanger: ['왕이 스스로 칼날 속으로 걸어갈 순 없다.', '그곳은 적의 시선 안이다.'],
};
export const pick = (a: string[]): string => a[Math.floor(Math.random() * a.length)];
export const illegalText = (r: IllegalReason): string => pick(ILLEGAL[r]);

export function setLoading(text: string | null): void {
  const el = $('loading');
  if (text === null) el.classList.add('gone');
  else el.textContent = text;
}
