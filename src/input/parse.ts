// 쓰거나 입력한 글을 명령으로 해석
export type Cmd =
  | { kind: 'move'; from: string; to: string }
  | { kind: 'square'; sq: string }
  | { kind: 'san'; san: string }
  | { kind: 'new' }
  | { kind: 'undo' }
  | { kind: 'flip' }
  | { kind: 'solo' }
  | { kind: 'duo' }
  | { kind: 'start' };

const PIECE: Record<string, string> = { 폰: '', 병사: '', 나이트: 'N', 기사: 'N', 말: 'N', 비숍: 'B', 룩: 'R', 퀸: 'Q', 여왕: 'Q', 킹: 'K', 왕: 'K' };

export function parse(raw: string): Cmd | null {
  const t = raw.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if (/(뒤로|무르|되돌|취소|undo|back)/.test(low)) return { kind: 'undo' };
  if (/(뒤집|flip|돌려)/.test(low)) return { kind: 'flip' };
  if (/(새\s*게임|새로|다시\s*하|재시작|처음|리셋|엎|new|reset|restart)/.test(low)) return { kind: 'new' };
  if (/^(o-o-o|0-0-0|퀸\s*사이드\s*캐슬링)$/.test(low)) return { kind: 'san', san: 'O-O-O' };
  if (/^(o-o|0-0|캐슬링|킹\s*사이드\s*캐슬링)$/.test(low)) return { kind: 'san', san: 'O-O' };
  const sq = low.match(/[a-h]\s*[1-8]/g)?.map((s) => s.replace(/\s/g, '')) ?? [];
  if (sq.length >= 2) return { kind: 'move', from: sq[0], to: sq[1] };
  if (sq.length === 1) {
    const name = Object.keys(PIECE).find((k) => t.includes(k));
    if (name !== undefined) return { kind: 'san', san: PIECE[name] + sq[0] };
    const san = t.match(/^([NBRQK])x?([a-h][1-8])$/);
    if (san) return { kind: 'san', san: san[1] + san[2] };
    return { kind: 'square', sq: sq[0] };
  }
  if (/(혼자|1\s*인|일인|솔로|컴퓨터|solo|^1$)/.test(low)) return { kind: 'solo' };
  if (/(둘이|2\s*인|이인|친구|같이|duo|^2$)/.test(low)) return { kind: 'duo' };
  if (/(체스|chess|게임|시작|하자|play|start|두자)/.test(low)) return { kind: 'start' };
  return null;
}
