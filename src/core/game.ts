// chess.js 래퍼 + 불법 이동 이유 판별 (규칙의 유일한 출처는 chess.js)
import { Chess, type Move, type Square } from 'chess.js';
import type { Color, PieceType } from '../render/shapes';

export type IllegalReason = 'notYourTurn' | 'pattern' | 'blocked' | 'ownPiece' | 'pinned' | 'inCheck' | 'kingDanger';

export class Game {
  chess = new Chess();

  turn(): Color { return this.chess.turn(); }

  pieceAt(sq: string): { type: PieceType; color: Color } | null {
    const p = this.chess.get(sq as Square);
    return p ? { type: p.type, color: p.color } : null;
  }

  legalFrom(sq: string): Move[] {
    return this.chess.moves({ square: sq as Square, verbose: true });
  }

  allMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /** from→to 합법 수. 승급이면 promo로 고른 말, 없으면 첫 후보 */
  find(from: string, to: string, promo?: string): Move | null {
    return this.legalFrom(from).find((m) => m.to === to && (!promo || m.promotion === promo)) ?? null;
  }

  /** 이 이동이 승급이면 고를 수 있는 말 목록 */
  promotions(from: string, to: string): PieceType[] {
    return this.legalFrom(from).filter((m) => m.to === to && m.promotion).map((m) => m.promotion as PieceType);
  }

  play(from: string, to: string, promotion?: string): Move | null {
    try {
      return this.chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return null;
    }
  }

  undo(): Move | null { return this.chess.undo(); }
  reset(): void { this.chess.reset(); }
  inCheck(): boolean { return this.chess.isCheck(); }

  kingSquare(c: Color): string | null {
    for (const row of this.chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === c) return p.square;
    return null;
  }

  status(): 'mate' | 'stalemate' | 'draw' | 'play' {
    if (this.chess.isCheckmate()) return 'mate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isDraw()) return 'draw';
    return 'play';
  }

  /** 왜 못 가는지: 모양 → 막힘 → 체크/핀 순서로 판단 */
  illegalReason(from: string, to: string): IllegalReason {
    const p = this.pieceAt(from);
    if (!p) return 'pattern';
    if (p.color !== this.turn()) return 'notYourTurn';
    const tgt = this.pieceAt(to);
    if (tgt && tgt.color === p.color) return 'ownPiece';
    const fx = from.charCodeAt(0) - 97;
    const fy = Number(from[1]);
    const tx = to.charCodeAt(0) - 97;
    const ty = Number(to[1]);
    const dx = tx - fx;
    const dy = ty - fy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const fwd = p.color === 'w' ? 1 : -1;
    let shape = false;
    let slide = false;
    switch (p.type) {
      case 'n': shape = (ax === 1 && ay === 2) || (ax === 2 && ay === 1); break;
      case 'b': shape = ax === ay && ax > 0; slide = true; break;
      case 'r': shape = (ax === 0) !== (ay === 0); slide = true; break;
      case 'q': shape = (ax === ay && ax > 0) || ((ax === 0) !== (ay === 0)); slide = true; break;
      case 'k': shape = Math.max(ax, ay) === 1 || (ay === 0 && ax === 2); break;
      case 'p': {
        const start = p.color === 'w' ? 2 : 7;
        if (dx === 0 && dy === fwd) shape = true;
        else if (dx === 0 && dy === 2 * fwd && fy === start) { shape = true; slide = true; }
        else if (ax === 1 && dy === fwd) shape = true;
        if (dx === 0 && tgt) return 'blocked';
        break;
      }
    }
    if (!shape) return 'pattern';
    if (slide) {
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      for (let i = 1; i < Math.max(ax, ay); i++) {
        const sq = String.fromCharCode(97 + fx + sx * i) + (fy + sy * i);
        if (this.pieceAt(sq)) return 'blocked';
      }
    }
    if (p.type === 'p' && ax === 1 && !tgt) return 'pattern';
    if (p.type === 'k') return 'kingDanger';
    return this.inCheck() ? 'inCheck' : 'pinned';
  }

  /** 아주 단순한 컴퓨터: 가장 비싼 말을 잡는 수 우선, 없으면 무작위 */
  aiMove(): Move | null {
    const ms = this.allMoves();
    if (!ms.length) return null;
    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let best: Move[] = [];
    let bv = -1;
    for (const m of ms) {
      const v = (m.captured ? val[m.captured] * 10 - val[m.piece] : 0) + (m.promotion ? val[m.promotion] * 10 : 0) + (m.san.includes('+') ? 2 : 0) + Math.random();
      if (v > bv) { bv = v; best = [m]; }
    }
    return best[0] ?? ms[0];
  }
}

export const KO: Record<PieceType, string> = { p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹' };
export const SIDE: Record<Color, string> = { w: '백', b: '흑' };
