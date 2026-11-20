// 게임 진행: 선택·이동·잡기 결투·뒤로 가기·판 뒤집기·새 게임
import gsap from 'gsap';
import type { Move } from 'chess.js';
import { S, type DuelMode } from '../config';
import { sfx } from '../audio/sfx';
import { Game, KO, SIDE } from '../core/game';
import { playDuel, type DuelRun } from '../cutscene/director';
import { makePiece, type PieceEnt } from '../render/entity';
import type { Color, PieceType } from '../render/shapes';
import type { World } from '../render/world';
import { animateMove, drawIn, glideAll, illegalBounce, pivotEdge, selectLift, washAway } from '../motion/moves';
import { illegalText, pick } from '../ui/panel';
import { moveLine, situation } from './narrator';
import { rad } from '../util/noise';
import { promoteAnim } from '../motion/promote';
import { LEVELS, think } from '../core/ai/engine';

const batchim = (w: string): boolean => (w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0;
export const iga = (w: string): string => w + (batchim(w) ? '이' : '가');
export const eul = (w: string): string => w + (batchim(w) ? '을' : '를');
export const VERB: Record<PieceType, string> = {
  p: '창으로 꿰뚫었다', n: '들이받아 날려 버렸다', b: '잉크로 녹여 버렸다',
  r: '짓눌러 부숴 버렸다', q: '세 번 베어 넘겼다', k: '단칼에 두 동강 냈다',
};

export class ChessCtl {
  game = new Game();
  ents = new Map<string, PieceEnt>();
  busy = true;
  selected: string | null = null;
  duel: DuelRun | null = null;
  mode: DuelMode = 'full';
  vsAI = false;
  /** 컴퓨터 난이도 1~5 */
  level = 3;
  thinking = false;
  private aiToken = 0;
  say: (t: string) => void = () => undefined;
  onTurn: (t: string) => void = () => undefined;
  /** 승급할 말 고르기 (화면에서 연결) */
  onPromote: (c: Color) => Promise<PieceType> = () => Promise.resolve('q');

  constructor(public w: World) {}

  /** 말 받침이 놓일 위치 */
  base(sq: string): [number, number] {
    const [x, y] = this.w.sqXY(sq);
    return [x + S / 2, y + S / 2 + 0.3 * S];
  }

  sync(): void {
    this.w.pieces = [];
    this.ents.clear();
    for (const row of this.game.chess.board()) {
      for (const p of row) {
        if (!p) continue;
        const [x, y] = this.base(p.square);
        const e = makePiece(p.type, p.color, x, y);
        this.w.pieces.push(e);
        this.ents.set(p.square, e);
      }
    }
    const h = this.game.chess.history({ verbose: true });
    const last = h[h.length - 1];
    this.w.lastMove = last ? [last.from, last.to] : [];
    this.w.markers = [];
    this.status(false);
  }

  status(announce = true): void {
    const st = this.game.status();
    const t = this.game.turn();
    this.w.checkSq = this.game.inCheck() ? this.game.kingSquare(t) : null;
    if (st === 'mate') {
      this.onTurn(`체크메이트 — ${SIDE[t === 'w' ? 'b' : 'w']}의 승리`);
      if (announce) this.finale(t);
      return;
    }
    if (st !== 'play') {
      this.onTurn(st === 'stalemate' ? '스테일메이트 — 무승부' : '무승부');
      if (announce) this.say('두 왕이 서로 고개를 숙인다. 이 페이지는 조용히 바랜다.');
      return;
    }
    this.onTurn(this.vsAI && t === 'b' ? '흑(컴퓨터)이 생각 중…' : `${SIDE[t]}의 차례`);
    if (announce && this.w.checkSq) {
      sfx.check();
      this.say(pick(['왕이 위험하다…', '체크. 칼끝이 왕을 겨눈다.', '왕의 그림자가 떨린다.']));
    }
  }

  private finale(loser: Color): void {
    const sq = this.game.kingSquare(loser);
    const k = sq ? this.ents.get(sq) : undefined;
    this.say(`체크메이트. 이 일기는 ${SIDE[loser === 'w' ? 'b' : 'w']}의 것이다. (새 게임을 누르면 새 페이지가 펼쳐진다)`);
    if (!k) return;
    pivotEdge(k, 1);
    gsap.timeline()
      .to(k, { rot: rad(-6), duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 })
      .to(k, { rot: rad(90), duration: 0.7, ease: 'bounce.out' })
      .call(() => { sfx.thud(1); this.w.drops.stain(k.x + 40, k.y + 3, 60, { a: 0.6, persist: 0.15, grow: 1 }); })
      .to(k, { dissolve: 1, duration: 1.4, ease: 'power1.in' });
  }

  // ---------- 선택 ----------
  select(sq: string): void {
    this.deselect();
    this.selected = sq;
    const e = this.ents.get(sq);
    if (e) selectLift(e, true);
    this.w.sel = { sq, t: 0 };
    gsap.to(this.w.sel, { t: 1, duration: 0.45, ease: 'power2.out' });
    sfx.tap();
    this.w.markers = this.game.legalFrom(sq).map((m) => ({ sq: m.to, kind: m.captured ? 'capture' : 'move', s: 0 }));
    this.w.markers.forEach((mk, i) => gsap.to(mk, { s: 1, duration: 0.3, delay: i * 0.03, ease: 'back.out(2)' }));
  }

  deselect(drop = true): void {
    if (this.selected && drop) {
      const e = this.ents.get(this.selected);
      if (e) selectLift(e, false);
    }
    this.selected = null;
    this.w.sel = null;
    this.w.markers = [];
  }

  /** 칸 하나를 눌렀거나 썼을 때 */
  async square(sq: string): Promise<void> {
    if (this.busy) return;
    const p = this.game.pieceAt(sq);
    if (this.selected && sq !== this.selected && !(p && p.color === this.game.turn())) return this.attempt(this.selected, sq);
    if (this.selected === sq) { this.deselect(); return; }
    if (p) {
      this.select(sq);
      if (p.color !== this.game.turn()) this.say(pick(['그건 상대의 말이다.', '아직 네 차례가 아니다.']));
      return;
    }
    this.say(`${sq}에는 아무것도 없다.`);
  }

  // ---------- 이동 ----------
  async attempt(from: string, to: string): Promise<void> {
    if (this.busy) return;
    const m = this.game.find(from, to);
    if (m) return this.execute(m);
    const ent = this.ents.get(from);
    if (!ent) { this.say(`${from}에는 움직일 말이 없다.`); return; }
    this.busy = true;
    const reason = this.game.illegalReason(from, to);
    this.deselect(false);
    const [hx, hy] = this.base(from);
    const [tx, ty] = this.base(to);
    this.say(illegalText(reason));
    await illegalBounce(this.w, ent, hx, hy, tx, ty);
    this.busy = false;
  }

  async san(san: string): Promise<void> {
    const m = this.game.allMoves().find((x) => x.san.replace(/[+#]/g, '') === san || x.san.replace(/[+#x]/g, '') === san);
    if (m) return this.execute(m);
    this.say(`'${san}' — 그런 수는 둘 수 없다.`);
  }

  async execute(move: Move): Promise<void> {
    let m = move;
    this.busy = true;
    this.deselect();
    const ent = this.ents.get(m.from);
    if (!ent) { this.busy = false; return; }
    // 승급: 사람이 둘 때는 끝 칸에 도착한 뒤 무엇이 될지 고른다
    const choose = !!m.promotion && !(this.vsAI && ent.color === 'b');
    if (!choose) this.game.play(m.from, m.to, m.promotion);
    const [tx, ty] = this.base(m.to);
    this.ents.delete(m.from);
    if (m.captured) {
      const vsq = m.flags.includes('e') ? m.to[0] + m.from[1] : m.to;
      const V = this.ents.get(vsq);
      if (V) {
        this.say(`${SIDE[ent.color]} ${iga(KO[ent.type])} ${m.to}의 ${eul(KO[V.type])} ${VERB[ent.type]}.`);
        this.duel = playDuel(this.w, ent, V, tx, ty, this.mode);
        await this.duel.done;
        this.duel = null;
        this.w.pieces = this.w.pieces.filter((p) => p !== V);
        this.ents.delete(vsq);
      }
    } else {
      await animateMove(this.w, ent, tx, ty);
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const r = m.to[1];
        const [rf, rt] = m.flags.includes('k') ? ['h' + r, 'f' + r] : ['a' + r, 'd' + r];
        const rook = this.ents.get(rf);
        if (rook) {
          this.ents.delete(rf);
          this.ents.set(rt, rook);
          await animateMove(this.w, rook, ...this.base(rt));
          this.say('왕이 성벽 뒤로 몸을 숨긴다. (캐슬링)');
        }
      } else {
        this.say(moveLine(m, this.vsAI));
      }
    }
    this.ents.set(m.to, ent);
    if (m.promotion) {
      let to = m.promotion as PieceType;
      if (choose) {
        this.say('병사가 끝에 닿았다. 무엇이 될 것인가?');
        to = await this.onPromote(ent.color);
        m = this.game.find(m.from, m.to, to) ?? m;
        this.game.play(m.from, m.to, to);
      }
      this.say(`병사가 잉크로 녹았다가 ${KO[to]}의 모습으로 다시 그려진다.`);
      await promoteAnim(this.w, ent, to);
    }
    this.w.lastMove = [m.from, m.to];
    const sit = situation(this.game, m, this.vsAI);
    if (sit && !this.game.inCheck()) gsap.delayedCall(0.9, () => this.say(sit));
    this.status();
    this.busy = false;
    if (this.vsAI && this.game.turn() === 'b' && this.game.status() === 'play') gsap.delayedCall(0.4, () => void this.aiTurn());
  }

  private redraw(ent: PieceEnt, to: PieceType, text?: string): Promise<void> {
    if (text) this.say(text);
    return new Promise((res) => {
      gsap.timeline({ onComplete: () => res() })
        .to(ent, { dissolve: 1, duration: 0.3, ease: 'power1.in' })
        .call(() => { ent.type = to; ent.dissolve = 0; ent.reveal = 0; sfx.scratch(); })
        .to(ent, { reveal: 1, duration: 0.45, ease: 'power1.inOut' });
    });
  }

  /** 컴퓨터 차례: 난이도에 맞춰 별도 작업자에서 생각한 뒤 둔다 */
  async aiTurn(): Promise<void> {
    const token = ++this.aiToken;
    this.thinking = true;
    this.busy = true;
    if (this.level >= 4) this.say(pick(['…잠시, 생각할 시간이 필요하다.', '잉크가 천천히 번진다. 나는 생각 중이다.']));
    const fen = this.game.chess.fen();
    const [r] = await Promise.all([think(fen, this.level), new Promise((res) => gsap.delayedCall(0.5, res))]);
    if (token !== this.aiToken) return; // 그사이 새 게임·뒤로 가기로 취소됨
    this.thinking = false;
    this.busy = false;
    const m = (r && (this.game.find(r.from, r.to, 'q') ?? this.game.find(r.from, r.to))) || this.game.aiMove();
    if (m) await this.execute(m);
  }

  /** 생각 중인 컴퓨터를 멈춤 */
  cancelAI(): void {
    if (!this.thinking) return;
    this.aiToken++;
    this.thinking = false;
    this.busy = false;
  }

  // ---------- 뒤로 가기: 한 수를 거꾸로 스르륵 ----------
  async undo(): Promise<void> {
    this.cancelAI();
    if (this.busy) return;
    const steps = this.vsAI && this.game.turn() === 'w' && this.game.chess.history().length >= 2 ? 2 : 1;
    if (!this.game.chess.history().length) { this.say('되돌릴 수가 없다. 아직 아무것도 쓰이지 않았다.'); return; }
    this.busy = true;
    this.deselect();
    for (let i = 0; i < steps; i++) {
      const m = this.game.undo();
      if (!m) break;
      const ent = this.ents.get(m.to);
      if (!ent) continue;
      this.ents.delete(m.to);
      if (m.promotion) await this.redraw(ent, 'p');
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const r = m.to[1];
        const [rf, rt] = m.flags.includes('k') ? ['h' + r, 'f' + r] : ['a' + r, 'd' + r];
        const rook = this.ents.get(rt);
        if (rook) { this.ents.delete(rt); this.ents.set(rf, rook); await animateMove(this.w, rook, ...this.base(rf)); }
      }
      await animateMove(this.w, ent, ...this.base(m.from));
      this.ents.set(m.from, ent);
      if (m.captured) {
        const vsq = m.flags.includes('e') ? m.to[0] + m.from[1] : m.to;
        const [vx, vy] = this.base(vsq);
        const back = makePiece(m.captured, m.color === 'w' ? 'b' : 'w', vx, vy);
        back.reveal = 0;
        this.w.pieces.push(back);
        this.ents.set(vsq, back);
        sfx.scratch();
        await new Promise<void>((r) => gsap.to(back, { reveal: 1, duration: 0.55, ease: 'power1.inOut', onComplete: () => r() }));
      }
    }
    const h = this.game.chess.history({ verbose: true });
    const last = h[h.length - 1];
    this.w.lastMove = last ? [last.from, last.to] : [];
    this.say('잉크가 거꾸로 흘러, 말이 제자리로 돌아간다.');
    this.status(false);
    this.busy = false;
  }

  // ---------- 판 뒤집기 ----------
  async flip(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.deselect();
    this.w.flipped = !this.w.flipped;
    this.w.rebuildBoard();
    const moves: { p: PieceEnt; x: number; y: number }[] = [];
    for (const [sq, p] of this.ents) { const [x, y] = this.base(sq); moves.push({ p, x, y }); }
    this.say(this.w.flipped ? '판이 돌아간다. 이제 흑의 자리에서 본다.' : '판이 돌아간다. 다시 백의 자리에서 본다.');
    await glideAll(moves, 0.9);
    this.busy = false;
  }

  // ---------- 새 게임 (판 엎기) ----------
  async newGame(): Promise<void> {
    this.cancelAI();
    if (this.busy && this.game.chess.history().length) return;
    this.busy = true;
    this.deselect();
    if (this.w.pieces.length) await washAway(this.w.pieces);
    this.game.reset();
    this.w.drops.stains = [];
    this.sync();
    await drawIn(this.w.pieces);
    const lv = LEVELS[this.level - 1];
    this.say(this.vsAI ? `새 페이지. 너는 백, 나는 흑이다. 오늘의 나는 ${lv.name}(난이도 ${lv.n}). 먼저 두어라.` : '새 페이지가 펼쳐진다. 백부터 시작한다.');
    this.busy = false;
  }
}
