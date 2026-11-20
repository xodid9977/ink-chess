// 체스 좌표 손글씨 인식 (a~h, 1~8). $P 점구름 인식기 + "글자-숫자" 문법 제약.
// 오프라인·즉시 동작. 한글 문장 인식은 하지 않는다.

export type Stroke = { x: number; y: number }[];
type P = { x: number; y: number; id: number };

const N = 32;

// ---- 템플릿: 0~1 상자 안 획 목록 (y는 아래로 +) ----
type G = number[]; // [x0,y0,x1,y1,...] 한 획
const T: Record<string, G[][]> = {
  a: [
    [[0.75, 0.35, 0.5, 0.22, 0.25, 0.35, 0.15, 0.6, 0.3, 0.85, 0.55, 0.85, 0.75, 0.62, 0.78, 0.3, 0.78, 0.92, 0.9, 0.98]],
    [[0.72, 0.35, 0.48, 0.22, 0.22, 0.38, 0.18, 0.65, 0.4, 0.88, 0.68, 0.75, 0.72, 0.4], [0.75, 0.25, 0.75, 0.95]],
  ],
  b: [
    [[0.25, 0, 0.25, 1, 0.25, 0.65, 0.45, 0.45, 0.7, 0.5, 0.8, 0.75, 0.6, 0.97, 0.3, 0.9]],
    [[0.25, 0, 0.25, 1], [0.25, 0.6, 0.5, 0.45, 0.78, 0.6, 0.75, 0.88, 0.5, 1, 0.25, 0.92]],
  ],
  c: [[[0.8, 0.4, 0.55, 0.28, 0.3, 0.4, 0.2, 0.65, 0.35, 0.92, 0.6, 0.97, 0.82, 0.85]]],
  d: [
    [[0.75, 0.55, 0.5, 0.45, 0.25, 0.55, 0.2, 0.8, 0.4, 0.98, 0.65, 0.9, 0.75, 0.7], [0.75, 0, 0.75, 1]],
    [[0.75, 0.55, 0.5, 0.45, 0.22, 0.58, 0.22, 0.85, 0.45, 1, 0.7, 0.85, 0.75, 0.0, 0.75, 1]],
  ],
  e: [[[0.2, 0.62, 0.8, 0.6, 0.75, 0.4, 0.5, 0.3, 0.25, 0.42, 0.18, 0.66, 0.35, 0.92, 0.62, 0.97, 0.82, 0.86]]],
  f: [
    [[0.75, 0.1, 0.55, 0, 0.4, 0.1, 0.38, 0.4, 0.38, 1], [0.15, 0.42, 0.7, 0.42]],
    [[0.7, 0.05, 0.45, 0.05, 0.42, 0.5, 0.4, 1], [0.15, 0.45, 0.68, 0.43]],
  ],
  g: [
    [[0.75, 0.32, 0.5, 0.2, 0.25, 0.3, 0.2, 0.5, 0.4, 0.66, 0.7, 0.55, 0.75, 0.3, 0.75, 0.95, 0.55, 1.12, 0.28, 1.02]],
    [[0.72, 0.3, 0.45, 0.2, 0.22, 0.38, 0.35, 0.62, 0.68, 0.55, 0.72, 0.3], [0.74, 0.25, 0.74, 0.95, 0.5, 1.12, 0.25, 1.0]],
  ],
  h: [
    [[0.25, 0, 0.25, 1, 0.25, 0.65, 0.45, 0.45, 0.65, 0.48, 0.75, 0.65, 0.75, 1]],
    [[0.25, 0, 0.25, 1], [0.25, 0.62, 0.48, 0.45, 0.72, 0.52, 0.75, 1]],
  ],
  '1': [
    [[0.5, 0, 0.5, 1]],
    [[0.28, 0.22, 0.5, 0, 0.5, 1]],
  ],
  '2': [
    [[0.2, 0.25, 0.4, 0.04, 0.65, 0.04, 0.8, 0.25, 0.7, 0.5, 0.2, 1, 0.85, 1]],
    [[0.18, 0.3, 0.45, 0.02, 0.78, 0.15, 0.75, 0.45, 0.2, 0.98, 0.5, 0.95, 0.85, 0.98]],
  ],
  '3': [
    [[0.2, 0.15, 0.5, 0, 0.75, 0.15, 0.7, 0.4, 0.45, 0.5, 0.75, 0.6, 0.8, 0.85, 0.5, 1, 0.2, 0.9]],
    [[0.2, 0.05, 0.75, 0.05, 0.45, 0.42, 0.75, 0.55, 0.8, 0.85, 0.5, 1, 0.2, 0.9]],
  ],
  '4': [
    [[0.6, 0, 0.15, 0.65, 0.85, 0.65], [0.65, 0.3, 0.65, 1]],
    [[0.22, 0, 0.2, 0.55, 0.82, 0.55], [0.7, 0, 0.7, 1]],
    [[0.22, 0, 0.2, 0.55, 0.82, 0.55, 0.7, 0.55, 0.7, 0, 0.7, 1]],
  ],
  '5': [
    [[0.75, 0, 0.3, 0, 0.25, 0.45, 0.55, 0.4, 0.8, 0.6, 0.75, 0.9, 0.45, 1, 0.2, 0.9]],
    [[0.3, 0, 0.25, 0.45, 0.55, 0.4, 0.8, 0.6, 0.75, 0.9, 0.45, 1, 0.2, 0.9], [0.3, 0, 0.8, 0]],
  ],
  '6': [[[0.7, 0.04, 0.4, 0.2, 0.2, 0.55, 0.25, 0.86, 0.5, 1, 0.75, 0.86, 0.75, 0.6, 0.5, 0.5, 0.25, 0.65]]],
  '7': [
    [[0.15, 0, 0.85, 0, 0.4, 1]],
    [[0.15, 0, 0.85, 0, 0.42, 1], [0.35, 0.5, 0.75, 0.5]],
  ],
  '8': [
    [[0.7, 0.12, 0.5, 0, 0.3, 0.12, 0.32, 0.35, 0.5, 0.48, 0.72, 0.65, 0.75, 0.88, 0.5, 1, 0.25, 0.88, 0.28, 0.65, 0.5, 0.48, 0.68, 0.35, 0.7, 0.12]],
    [[0.5, 0, 0.28, 0.2, 0.5, 0.45, 0.72, 0.2, 0.5, 0], [0.5, 0.48, 0.22, 0.75, 0.5, 1, 0.78, 0.75, 0.5, 0.48]],
  ],
};

const LETTERS = 'abcdefgh'.split('');
const DIGITS = '12345678'.split('');

function toPoints(strokes: Stroke[]): P[] {
  const out: P[] = [];
  strokes.forEach((s, id) => s.forEach((p) => out.push({ x: p.x, y: p.y, id })));
  return out;
}

function pathLen(pts: P[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function resample(src: P[], n: number): P[] {
  const pts = src.map((p) => ({ ...p }));
  const I = pathLen(pts) / (n - 1);
  if (I <= 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let D = 0;
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I) {
      const t = (I - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

function normalize(src: P[]): P[] {
  const pts = resample(src, N);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const s = Math.max(maxX - minX, maxY - minY) || 1;
  const sc = pts.map((p) => ({ x: (p.x - minX) / s, y: (p.y - minY) / s, id: p.id }));
  const cx = sc.reduce((a, p) => a + p.x, 0) / N;
  const cy = sc.reduce((a, p) => a + p.y, 0) / N;
  return sc.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

function cloudDist(a: P[], b: P[], start: number): number {
  const matched = new Array<boolean>(N).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity;
    let idx = -1;
    for (let j = 0; j < N; j++) {
      if (matched[j]) continue;
      const d = (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2;
      if (d < min) { min = d; idx = j; }
    }
    matched[idx] = true;
    sum += (1 - ((i - start + N) % N) / N) * Math.sqrt(min);
    i = (i + 1) % N;
  } while (i !== start);
  return sum;
}

function match(a: P[], b: P[]): number {
  const step = Math.floor(Math.pow(N, 0.5));
  let min = Infinity;
  for (let i = 0; i < N; i += step) min = Math.min(min, cloudDist(a, b, i), cloudDist(b, a, i));
  return min;
}

interface Tmpl { ch: string; pts: P[]; aspect: number }
const TEMPLATES: Tmpl[] = [];
for (const [ch, variants] of Object.entries(T)) {
  for (const v of variants) {
    // 손글씨 편차를 흉내 낸 변형: 기울기 × 가로 폭
    for (const slant of [-0.18, 0, 0.18]) {
      for (const wx of [0.8, 1, 1.25]) {
        const strokes: Stroke[] = v.map((g) => {
          const s: Stroke = [];
          for (let i = 0; i < g.length; i += 2) s.push({ x: (g[i] + (1 - g[i + 1]) * slant) * wx, y: g[i + 1] });
          return s;
        });
        TEMPLATES.push({ ch, pts: normalize(toPoints(strokes)), aspect: aspectOf(strokes) });
      }
    }
  }
}

function aspectOf(strokes: Stroke[]): number {
  const b = bbox(strokes);
  return (b.maxX - b.minX + 0.05) / (b.maxY - b.minY + 0.05);
}

function bbox(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}

/** 글자별 최고 점수 상위 k개 */
function classifyTop(strokes: Stroke[], allowed: string[], penalty: Record<string, number> = {}, k = 3): { ch: string; score: number }[] {
  const pts = normalize(toPoints(strokes));
  const asp = aspectOf(strokes);
  const best = new Map<string, number>();
  for (const t of TEMPLATES) {
    if (!allowed.includes(t.ch)) continue;
    const s = match(pts, t.pts) + Math.abs(Math.log(asp / t.aspect)) * 1.2 + (penalty[t.ch] ?? 0);
    if (s < (best.get(t.ch) ?? Infinity)) best.set(t.ch, s);
  }
  return [...best.entries()].map(([ch, score]) => ({ ch, score })).sort((a, b) => a.score - b.score).slice(0, k);
}

export interface Cand { text: string; score: number }

/** 여러 후보: 'e2' 또는 'e2e4' 형태, 점수가 낮을수록 그럴듯함 */
export function readCandidates(strokes: Stroke[]): Cand[] {
  const groups = segment(strokes);
  if (groups.length !== 2 && groups.length !== 4) return [];
  let combos: Cand[] = [{ text: '', score: 0 }];
  for (let i = 0; i < groups.length; i += 2) {
    const L = groups[i];
    const D = groups[i + 1];
    const lb = bbox(L);
    const db = bbox(D);
    const dh = Math.max(1, db.maxY - db.minY);
    const pen: Record<string, number> = {};
    if (lb.maxY > db.maxY + dh * 0.18) for (const c of 'abcdeh') pen[c] = 0.8;
    else if (lb.maxY < db.maxY + dh * 0.08) pen.g = 0.8;
    if (lb.minY > db.minY + dh * 0.3) for (const c of 'bdfh') pen[c] = (pen[c] ?? 0) + 0.8;
    const ls = classifyTop(L, LETTERS, pen, 3).map((r) => (r.ch === 'b' || r.ch === 'h' ? { ...r, score: r.score + ((r.ch === 'b') === closedBottom(L) ? 0 : 0.5) } : r));
    const ds = classifyTop(D, DIGITS, {}, 3);
    const next: Cand[] = [];
    for (const c of combos) for (const l of ls) for (const d of ds) next.push({ text: c.text + l.ch + d.ch, score: c.score + l.score + d.score });
    combos = next;
  }
  return combos.sort((a, b) => a.score - b.score);
}

/** 한 글자 분류: 허용 문자 중 가장 가까운 것과 점수 */
function classify(strokes: Stroke[], allowed: string[], penalty: Record<string, number> = {}): { ch: string; score: number } {
  const pts = normalize(toPoints(strokes));
  const asp = aspectOf(strokes);
  let best = { ch: '?', score: Infinity };
  for (const t of TEMPLATES) {
    if (!allowed.includes(t.ch)) continue;
    const s = match(pts, t.pts) + Math.abs(Math.log(asp / t.aspect)) * 1.2 + (penalty[t.ch] ?? 0);
    if (s < best.score) best = { ch: t.ch, score: s };
  }
  return best;
}

/** 획들을 글자 단위로 묶기 (x 범위가 겹치면 같은 글자) */
export function segment(strokes: Stroke[]): Stroke[][] {
  const items = strokes.filter((s) => s.length > 1).map((s) => ({ s, b: bbox([s]) })).sort((a, b) => a.b.minX - b.b.minX);
  const groups: { ss: Stroke[]; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    const w = g ? g.maxX - g.minX : 0;
    const iw = it.b.maxX - it.b.minX;
    const ih = it.b.maxY - it.b.minY;
    const H = g ? Math.max(g.maxY - g.minY, ih) : ih;
    const overlap = g && it.b.minX < g.maxX - Math.min(w, iw) * 0.25;
    // 세로 막대(d·h·b의 기둥, 4의 세로획)는 바로 옆 글자에 붙임
    const stem = g && (iw < ih * 0.3 || w < (g.maxY - g.minY) * 0.3) && it.b.minX - g.maxX < H * 0.08;
    if (g && (overlap || stem)) {
      g.ss.push(it.s);
      g.minX = Math.min(g.minX, it.b.minX); g.maxX = Math.max(g.maxX, it.b.maxX);
      g.minY = Math.min(g.minY, it.b.minY); g.maxY = Math.max(g.maxY, it.b.maxY);
    } else groups.push({ ss: [it.s], ...it.b });
  }
  const lineH = Math.max(1, ...groups.map((g) => g.maxY - g.minY));
  // 짧은 가로줄(e2-e4의 '-')이나 점은 구분 기호로 보고 버림
  return groups.filter((g) => !(g.maxY - g.minY < lineH * 0.22 && g.maxX - g.minX < lineH * 0.7)).map((g) => g.ss);
}

export interface Reading { text: string; confidence: number }

/** 좌표 1개(e2) 또는 2개(e2 e4)를 읽음. 실패하면 null */
export function readSquares(strokes: Stroke[]): Reading | null {
  const groups = segment(strokes);
  if (groups.length !== 2 && groups.length !== 4) return null;
  let text = '';
  let worst = 0;
  for (let i = 0; i < groups.length; i += 2) {
    const L = groups[i];
    const D = groups[i + 1];
    const lb = bbox(L);
    const db = bbox(D);
    const dh = Math.max(1, db.maxY - db.minY);
    // 옆 숫자와 비교한 글자 높이로 판단 보조: g는 아래로 내려오고, a·c·e는 키가 작다
    const pen: Record<string, number> = {};
    const desc = lb.maxY > db.maxY + dh * 0.18;
    const short = lb.minY > db.minY + dh * 0.3;
    if (desc) for (const c of 'abcdeh') pen[c] = 0.8;
    else if (lb.maxY < db.maxY + dh * 0.08) pen.g = 0.8;
    if (short) for (const c of 'bdfh') pen[c] = (pen[c] ?? 0) + 0.8;
    let r = classify(L, LETTERS, pen);
    if (r.ch === 'b' || r.ch === 'h') r = { ...r, ch: closedBottom(L) ? 'b' : 'h' };
    const d = classify(D, DIGITS);
    text += r.ch + d.ch;
    worst = Math.max(worst, r.score, d.score);
  }
  return { text, confidence: Math.max(0, 1 - worst / 9) };
}

/** b와 h 구분: 아래쪽 가운데에 잉크가 지나가면 닫힌 b */
function closedBottom(strokes: Stroke[]): boolean {
  const b = bbox(strokes);
  const w = b.maxX - b.minX || 1;
  const h = b.maxY - b.minY || 1;
  let n = 0;
  for (const s of strokes) for (const p of s) {
    const u = (p.x - b.minX) / w;
    const v = (p.y - b.minY) / h;
    if (v > 0.84 && u > 0.38 && u < 0.78) n++;
  }
  return n >= 2;
}

/** 숫자 하나 읽기 (1인/2인 선택용) */
export function readDigit(strokes: Stroke[], allowed = DIGITS): string | null {
  const groups = segment(strokes);
  if (groups.length !== 1) return null;
  return classify(groups[0], allowed).ch;
}

/** 디버그: 템플릿별 점수 */
export function scores(strokes: Stroke[], allowed: string[]): { ch: string; m: number; a: number }[] {
  const pts = normalize(toPoints(strokes));
  const asp = aspectOf(strokes);
  return TEMPLATES.filter((t) => allowed.includes(t.ch)).map((t) => ({ ch: t.ch, m: +match(pts, t.pts).toFixed(2), a: +(Math.abs(Math.log(asp / t.aspect)) * 1.2).toFixed(2) }));
}
