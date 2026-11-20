// 잉크 체스 — 시작 화면(쓰면 시작) → 1인/2인 → 대국. 펜으로 쓰거나 눌러서 둔다.
import gsap from 'gsap';
import '@fontsource/nanum-pen-script';
import '@fontsource/gowun-batang';
import './style.css';
import { S, type DuelMode } from './config';
import { audio } from './audio/sfx';
import { ChessCtl, eul, iga, VERB } from './app/chess';
import { KO } from './core/game';
import { playDuel, tickBursts } from './cutscene/director';
import { InkPad } from './input/pad';
import { parse, type Cmd } from './input/parse';
import { readDigit } from './input/recognizer';
import { makePiece, type PieceEnt } from './render/entity';
import { preloadArt } from './render/pieceArt';
import { GEOM, type PieceType } from './render/shapes';
import { World } from './render/world';
import { drawIn } from './motion/moves';
import { $, diary, setLoading, setTurn, write } from './ui/panel';
import { pickPromotion } from './ui/promoPicker';

const canvas = $<HTMLCanvasElement>('board');
const stage = $('stage');
const world = new World(canvas);
const ctl = new ChessCtl(world);
ctl.say = diary;
ctl.onTurn = setTurn;
ctl.onPromote = pickPromotion;
ctl.mode = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'short' : 'full';

function resize(): void {
  const r = stage.getBoundingClientRect();
  world.resize(r.width, r.height);
}

// ---------- 명령 실행 ----------
async function run(cmd: Cmd | null, heard: string): Promise<void> {
  if (!cmd) { diary(`'${heard}' …무슨 뜻인지 모르겠다. 예: e2 e4, 새 게임, 뒤로, 판 뒤집기`); return; }
  if (cmd.kind === 'new' && ctl.duel) ctl.duel.skip();
  // 말이 아직 움직이는 중이면 끝날 때까지 기다렸다가 실행
  for (let i = 0; i < 80 && ctl.busy && !ctl.duel; i++) await new Promise((r) => gsap.delayedCall(0.1, r));
  if (ctl.busy) { diary('잠깐, 펜이 아직 움직이는 중이다.'); return; }
  switch (cmd.kind) {
    case 'move':
      if (ctl.game.pieceAt(cmd.from)) ctl.select(cmd.from);
      await new Promise((r) => gsap.delayedCall(0.3, r));
      return ctl.attempt(cmd.from, cmd.to);
    case 'square': return ctl.square(cmd.sq);
    case 'san': return ctl.san(cmd.san);
    case 'undo': return ctl.undo();
    case 'flip': return ctl.flip();
    case 'solo': ctl.vsAI = true; return ctl.newGame();
    case 'duo': ctl.vsAI = false; return ctl.newGame();
    default: return ctl.newGame();
  }
}


document.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach((b) =>
  b.addEventListener('click', () => void run(parse(b.dataset.cmd === 'new' ? '새 게임' : b.dataset.cmd === 'undo' ? '뒤로' : '판 뒤집기'), b.textContent ?? '')));
const sndBtn = $<HTMLButtonElement>('btn-sound');
sndBtn.addEventListener('click', () => { audio.on = !audio.on; sndBtn.textContent = audio.on ? '소리 켬' : '소리 끔'; });
const duelBtn = $<HTMLButtonElement>('btn-duel');
const DUEL_NAMES: Record<DuelMode, string> = { full: '결투: 전부', short: '결투: 짧게', off: '결투: 끔' };
duelBtn.textContent = DUEL_NAMES[ctl.mode];
duelBtn.addEventListener('click', () => {
  ctl.mode = ctl.mode === 'full' ? 'short' : ctl.mode === 'short' ? 'off' : 'full';
  duelBtn.textContent = DUEL_NAMES[ctl.mode];
});

// ---------- 보드 터치/클릭/끌기 ----------
let drag: { ent: PieceEnt; sq: string; dx: number; dy: number; moved: boolean } | null = null;

function hit(wx: number, wy: number): string | null {
  let best: PieceEnt | null = null;
  for (const p of world.pieces) {
    if (!p.visible) continue;
    const h = GEOM[p.type].height * S;
    if (Math.abs(wx - p.x) < 0.3 * S && wy < p.y + 6 && wy > p.y - p.lift - h && (!best || p.y > best.y)) best = p;
  }
  if (best) for (const [sq, e] of ctl.ents) if (e === best) return sq;
  return world.sqAt(wx, wy);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ctl.duel) { ctl.duel.skip(); return; }
  if (ctl.busy) return;
  const [wx, wy] = world.toWorld(ev.offsetX, ev.offsetY);
  const sq = hit(wx, wy);
  if (!sq) { ctl.deselect(); return; }
  const p = ctl.game.pieceAt(sq);
  const mine = p && p.color === ctl.game.turn() && !(ctl.vsAI && p.color === 'b');
  if (ctl.selected && sq !== ctl.selected && !mine) { void ctl.attempt(ctl.selected, sq); return; }
  if (ctl.selected === sq) { ctl.deselect(); return; }
  if (p) {
    ctl.select(sq);
    const e = ctl.ents.get(sq);
    if (e && mine) { drag = { ent: e, sq, dx: e.x - wx, dy: e.y - wy, moved: false }; canvas.setPointerCapture(ev.pointerId); }
    return;
  }
  ctl.deselect();
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const [wx, wy] = world.toWorld(ev.offsetX, ev.offsetY);
  const nx = wx + drag.dx;
  const ny = wy + drag.dy;
  if (!drag.moved && Math.hypot(nx - drag.ent.x, ny - drag.ent.y) < 8) return;
  drag.moved = true;
  gsap.killTweensOf(drag.ent, 'x,y');
  drag.ent.x = nx;
  drag.ent.y = ny;
});

canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;
  const to = world.sqAt(d.ent.x, d.ent.y - 0.3 * S);
  if (!to || to === d.sq) {
    const [hx, hy] = ctl.base(d.sq);
    gsap.to(d.ent, { x: hx, y: hy, duration: 0.35, ease: 'power2.inOut' });
    return;
  }
  void ctl.attempt(d.sq, to);
});

window.addEventListener('keydown', (e) => {
  if (ctl.duel && (e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); ctl.duel.skip(); }
});

// ---------- 시작 화면: 빈 일기장에 무엇이든 쓰면 시작 ----------
let phase: 'ask' | 'mode' | 'done' = 'ask';
const introPad = new InkPad($<HTMLCanvasElement>('intro-pad'));
introPad.idleMs = 1100;

function askMode(): void {
  phase = 'mode';
  write('intro-text', '체스를 두자. 혼자 둘 것인가, 둘이서 둘 것인가?', 2);
  window.setTimeout(() => write('intro-text', '1 또는 2를 써라.', 2), 1900);
  $('intro-choices').hidden = false;
}

function startGame(solo: boolean): void {
  if (phase === 'done') return;
  phase = 'done';
  ctl.vsAI = solo;
  write('intro-text', solo ? '좋다. 너는 백, 나는 흑이다.' : '좋다. 둘이서 펜을 나누어 쥐어라.', 2);
  window.setTimeout(() => {
    $('intro').classList.add('leaving');
    window.setTimeout(() => { $('intro').hidden = true; }, 900);
    ctl.busy = false;
    void ctl.newGame();
  }, 1300);
}

function introHeard(cmd: Cmd | null): void {
  if (phase === 'ask') {
    if (cmd?.kind === 'solo') return startGame(true);
    if (cmd?.kind === 'duo') return startGame(false);
    return askMode();
  }
  if (phase === 'mode') {
    if (cmd?.kind === 'solo') return startGame(true);
    if (cmd?.kind === 'duo') return startGame(false);
    write('intro-text', '혼자면 1, 둘이면 2를 써라.', 2);
  }
}

introPad.onDone = (strokes) => {
  introPad.clear();
  $('intro-pad-wrap').classList.remove('inked');
  // 시작 화면에서는 어떤 글씨든 '시작하자'는 뜻으로 받아들인다. 모드 질문에서는 숫자 1/2를 읽는다.
  if (phase === 'mode') {
    const d = readDigit(strokes, ['1', '2']);
    introHeard(d === '1' ? { kind: 'solo' } : d === '2' ? { kind: 'duo' } : null);
  } else introHeard({ kind: 'start' });
};
$<HTMLCanvasElement>('intro-pad').addEventListener('pointerdown', () => $('intro-pad-wrap').classList.add('inked'));
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => startGame(b.dataset.mode === 'solo')));

// ---------- 루프 ----------
window.addEventListener('resize', resize);
resize();
let frozen = false; // 개발용 정지
gsap.ticker.add((_t, deltaMs) => {
  const dt = Math.min(0.05, deltaMs / 1000);
  if (frozen) { world.draw(); return; }
  world.update(dt);
  tickBursts(dt * world.fxScale);
  world.draw();
});

// ---------- 개발용: 결투 미리보기, 프레임 단위 검사 ----------
async function gallery(a: PieceType, v: PieceType): Promise<void> {
  if (ctl.busy) return;
  ctl.busy = true;
  ctl.deselect();
  const saved = world.drops.stains.slice();
  world.pieces.forEach((p) => (p.visible = false));
  const [ax, ay] = ctl.base('b4');
  const [vx, vy] = ctl.base('e4');
  const A = makePiece(a, 'w', ax, ay);
  const V = makePiece(v, 'b', vx, vy);
  world.pieces.push(A, V);
  diary(`[결투 미리보기] 백 ${iga(KO[a])} 흑 ${eul(KO[v])} ${VERB[a]}.`);
  ctl.duel = playDuel(world, A, V, vx, vy, ctl.mode === 'off' ? 'full' : ctl.mode);
  await ctl.duel.done;
  ctl.duel = null;
  world.pieces = world.pieces.filter((p) => p !== A && p !== V);
  world.pieces.forEach((p) => (p.visible = true));
  world.drops.stains = saved;
  ctl.busy = false;
}
interface InkDebug { step: (sec: number) => void; gallery: typeof gallery; world: World; ctl: ChessCtl; start: (solo: boolean) => void }
if (import.meta.env.DEV) {
  const dbg: InkDebug = {
    step: (sec) => {
      gsap.ticker.lagSmoothing(100, 16);
      frozen = false;
      gsap.globalTimeline.resume();
      for (let i = 0; i < Math.max(1, Math.round(sec * 60)); i++) {
        const t0 = performance.now();
        while (performance.now() - t0 < 16.6) { /* 대기 */ }
        gsap.ticker.tick();
      }
      gsap.globalTimeline.pause();
      frozen = true;
    },
    gallery, world, ctl, start: startGame,
  };
  (window as unknown as { __ink: InkDebug }).__ink = dbg;
}
// 결투 미리보기 단축 링크: ?duel=q-b
const duelQ = new URLSearchParams(location.search).get('duel');

async function boot(): Promise<void> {
  try { await document.fonts.load('26px "Nanum Pen Script"'); } catch { /* 폰트 없이도 진행 */ }
  world.rebuildBoard();
  await preloadArt((i, n) => setLoading(`펜이 말을 그리는 중… ${i}/${n}`));
  setLoading(null);
  write('intro-text', '…누구지?', 2);
  window.setTimeout(() => write('intro-text', '이 일기장에 무엇이든 써 보아라.', 2), 1300);
  if (duelQ) {
    const [a, v] = duelQ.split('-') as PieceType[];
    $('intro').hidden = true;
    phase = 'done';
    ctl.sync();
    await drawIn(world.pieces);
    ctl.busy = false;
    void gallery(a, v);
  }
}
void boot();
