// 일기장의 목소리: 수가 놓일 때마다 판의 상황을 이야기한다 (컴퓨터 상대일 땐 일기장이 '나'로 말함)
import type { Move, Square } from 'chess.js';
import { KO, SIDE, type Game } from '../core/game';
import type { Color, PieceType } from '../render/shapes';

const pick = (a: string[]): string => a[Math.floor(Math.random() * a.length)];
const batchim = (w: string): boolean => (w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0;
const iga = (w: string): string => w + (batchim(w) ? '이' : '가');
const eul = (w: string): string => w + (batchim(w) ? '을' : '를');
const eun = (w: string): string => w + (batchim(w) ? '은' : '는');

const VAL: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const STEP: Record<PieceType, string[]> = {
  p: ['{s} 병사가 {to}로 한 걸음 내딛는다.', '{s} 폰이 조용히 {to}까지 나아간다.', '{s} 병사 하나가 {to}에 자리를 잡는다.'],
  n: ['{s} 기사가 {to}로 뛰어든다.', '{s} 나이트가 담을 넘듯 {to}에 내려앉는다.', '말발굽 소리. {s} 기사가 {to}에 섰다.'],
  b: ['{s} 비숍이 대각선을 따라 {to}에 이른다.', '{s} 비숍이 비스듬히 {to}까지 미끄러진다.'],
  r: ['{s} 룩이 {to}까지 밀고 나간다.', '무거운 성벽이 {to}로 옮겨진다.'],
  q: ['{s} 여왕이 {to}로 미끄러진다.', '{s} 퀸이 {to}에 내려선다. 판이 술렁인다.'],
  k: ['{s} 왕이 조심스레 {to}로 옮긴다.', '{s} 왕이 한 걸음, {to}.'],
};
const MINE: Record<PieceType, string[]> = {
  p: ['나는 {to}에 병사를 세운다.', '내 병사 하나를 {to}로 보낸다.'],
  n: ['내 기사를 {to}로 보낸다.', '나는 {to}에 기사를 내려놓는다.'],
  b: ['내 비숍이 {to}까지 간다.', '대각선 끝, {to}. 내 비숍의 자리다.'],
  r: ['내 룩을 {to}로 민다.'],
  q: ['내 여왕이 {to}에 선다. …조심하는 게 좋을 거다.', '나는 여왕을 {to}로 보낸다.'],
  k: ['나는 왕을 {to}로 옮긴다.'],
};

function material(game: Game): number {
  let v = 0;
  for (const row of game.chess.board()) for (const p of row) if (p) v += (p.color === 'w' ? 1 : -1) * VAL[p.type];
  return v;
}

/** 이동(잡기 제외) 한 줄 */
export function moveLine(m: Move, vsAI: boolean): string {
  const t = m.piece as PieceType;
  const tpl = vsAI && m.color === 'b' ? pick(MINE[t]) : pick(STEP[t]);
  return tpl.replace('{s}', SIDE[m.color as Color]).split('{to}').join(m.to);
}

/** 수가 놓인 뒤 판의 상황: 위협, 무방비, 형세 */
export function situation(game: Game, m: Move, vsAI: boolean): string | null {
  const me = m.color as Color;
  const foe: Color = me === 'w' ? 'b' : 'w';
  const c = game.chess;
  const t = m.piece as PieceType;
  const ai = vsAI && me === 'b';
  // 1) 움직인 말이 상대의 큰 말을 노리는가
  let target: { sq: string; type: PieceType } | null = null;
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== foe || p.type === 'k') continue;
    if (VAL[p.type] <= VAL[t] && p.type !== 'q') continue;
    if (c.attackers(p.square as Square, me).includes(m.to as Square) && (!target || VAL[p.type] > VAL[target.type])) target = { sq: p.square, type: p.type };
  }
  if (target) {
    return ai
      ? pick([`네 ${eul(KO[target.type])} 보고 있다. ${target.sq}, 그 자리가 편한가?`, `${target.sq}의 ${KO[target.type]}… 내 것이 될지도 모르겠군.`])
      : pick([`${SIDE[me]} ${iga(KO[t])} ${target.sq}의 ${eul(KO[target.type])} 노린다.`, `칼끝이 ${target.sq}의 ${KO[target.type]}에게 향한다.`]);
  }
  // 2) 움직인 말이 무방비로 드러났는가
  const hit = c.attackers(m.to as Square, foe).length;
  const guard = c.attackers(m.to as Square, me).length;
  if (hit > 0 && guard === 0 && t !== 'k' && VAL[t] >= 3) {
    return ai ? '…일부러 내어 준 걸까, 실수일까. 생각해 보아라.' : pick([`하지만 ${m.to}의 ${eun(KO[t])} 아무도 지켜 주지 않는다.`, `${m.to}… 무방비다. 잉크가 마르기 전에 다시 생각해 보아라.`]);
  }
  // 3) 잡기가 있었으면 형세
  if (m.captured) {
    const v = material(game);
    if (v === 0) return '형세는 아직 팽팽하다.';
    const lead = v > 0 ? '백' : '흑';
    return Math.abs(v) >= 5 ? `${lead}이 크게 앞서기 시작했다.` : `${lead}이 조금 앞선다.`;
  }
  // 4) 초반 분위기
  const n = c.history().length;
  if (n === 1) return ai ? '첫 수가 놓였군. 이야기를 시작해 볼까.' : '첫 잉크가 종이에 스민다. 이야기가 시작된다.';
  if (n === 10) return '말들이 깨어나 판 한가운데로 모여든다.';
  if (n === 30) return '판 위의 잉크가 점점 진해진다. 중반이다.';
  return null;
}
