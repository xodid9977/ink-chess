// 톰 리들 일기장식 글씨: 흩어진 잉크 입자가 모여 글자가 되고, 번진 채 마르며, 지울 때는 다시 흩어진다
import gsap from 'gsap';
import { INK } from '../config';

const ink = (a: number): string => `rgba(${INK[0]},${INK[1]},${INK[2]},${a})`;
const ease3 = (u: number): number => 1 - Math.pow(1 - u, 3);
const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Line {
  sharp: HTMLCanvasElement;
  wet: HTMLCanvasElement;
  w: number;
  parts: Float32Array; // tx, ty, sx, sy, delay
  n: number;
  t: number;
  state: 'gather' | 'still' | 'scatter';
  y: number;
  ty: number;
  dim: number; // 0 = 새 글, 1 = 오래되어 바랜 글
}

const GATHER = 0.62; // 입자 하나가 모이는 시간
const SPREAD = 0.6; // 왼쪽→오른쪽으로 써지는 시간 차

export class InkText {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lines: Line[] = [];
  private dpr = 1;
  private W = 0;
  private H = 0;
  private queue = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private el: HTMLElement, private keep = 4, private align: 'top' | 'bottom' = 'bottom') {
    this.cv = document.createElement('canvas');
    this.cv.className = 'ink-text';
    el.appendChild(this.cv);
    const c = this.cv.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('no 2d');
    this.ctx = c;
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    gsap.ticker.add((_t, dms) => this.tick(Math.min(0.05, dms / 1000)));
  }

  private get size(): number {
    return parseFloat(getComputedStyle(this.el).fontSize) || 24;
  }
  private get lh(): number {
    return this.size * 1.32;
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.place(true);
  }

  /** 문장을 폭에 맞게 줄바꿈 */
  private wrap(text: string): string[] {
    const m = document.createElement('canvas').getContext('2d');
    if (!m) return [text];
    m.font = `${this.size}px "Nanum Pen Script", cursive`;
    const out: string[] = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const t = cur ? `${cur} ${word}` : word;
      if (m.measureText(t).width > this.W - 8 && cur) { out.push(cur); cur = word; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }

  private build(text: string): Line {
    const d = this.dpr;
    const w = Math.ceil(this.W * d);
    const h = Math.ceil(this.lh * d);
    const mk = (blur: number, a: number): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      if (!x) return c;
      x.scale(d, d);
      x.font = `${this.size}px "Nanum Pen Script", cursive`;
      x.textBaseline = 'middle';
      if (blur) x.filter = `blur(${blur}px)`;
      x.fillStyle = ink(a);
      x.fillText(text, 2, this.lh / 2);
      if (!blur) {
        // 마른 잉크: 살짝 번진 테두리 + 진한 심
        x.globalCompositeOperation = 'destination-over';
        x.filter = 'blur(1.1px)';
        x.fillStyle = ink(0.45);
        x.fillText(text, 2, this.lh / 2);
      }
      return c;
    };
    const sharp = mk(0, 0.9);
    const wet = mk(3.2, 0.55);
    // 글자 모양에서 입자 위치 뽑기
    const data = sharp.getContext('2d')?.getImageData(0, 0, w, h).data;
    const pts: number[] = [];
    const step = Math.max(2, Math.round(1.8 * d));
    if (data) {
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > 110) pts.push(x / d, y / d);
    }
    const max = 1800;
    const n = Math.min(max, pts.length / 2);
    const parts = new Float32Array(n * 5);
    let maxX = 1;
    for (let i = 0; i < pts.length; i += 2) maxX = Math.max(maxX, pts[i]);
    for (let i = 0; i < n; i++) {
      const k = Math.floor((i / n) * (pts.length / 2)) * 2;
      const tx = pts[k];
      const ty = pts[k + 1];
      const a = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 70;
      parts.set([tx, ty, tx + Math.cos(a) * dist - 12, ty + Math.sin(a) * dist * 0.7, (tx / maxX) * SPREAD + Math.random() * 0.14], i * 5);
    }
    return { sharp, wet, w: maxX, parts, n, t: 0, state: 'gather', y: 0, ty: 0, dim: 0 };
  }

  /** 새 문장을 쓴다 (긴 문장은 여러 줄로) */
  write(text: string): void {
    // 한글 글꼴은 글자 묶음별로 나중에 내려받히므로, 필요한 글자를 먼저 불러온 뒤 그린다 (순서 유지)
    const font = `${this.size}px "Nanum Pen Script"`;
    this.chain = this.chain
      .then(() => document.fonts.load(font, text).then(() => undefined, () => undefined))
      .then(() => this.writeNow(text));
  }

  private writeNow(text: string): void {
    const rows = this.wrap(text);
    const live = this.lines.filter((l) => l.state !== 'scatter');
    live.forEach((l) => (l.dim = 1));
    rows.forEach((row, i) => {
      const line = this.build(row);
      line.t = -i * (SPREAD + 0.25) - this.queue;
      this.lines.push(line);
    });
    // 넘치는 오래된 줄은 흩어져 사라짐
    const alive = this.lines.filter((l) => l.state !== 'scatter');
    for (let i = 0; i < alive.length - this.keep; i++) { alive[i].state = 'scatter'; alive[i].t = 0; }
    this.place(false);
  }

  /** 전부 흩어 지우기 */
  clear(): void {
    for (const l of this.lines) if (l.state !== 'scatter') { l.state = 'scatter'; l.t = 0; }
  }

  private place(snap: boolean): void {
    const alive = this.lines.filter((l) => l.state !== 'scatter');
    alive.forEach((l, i) => {
      l.ty = this.align === 'bottom' ? this.H - (alive.length - i) * this.lh : i * this.lh;
      if (snap || l.t <= 0) l.y = l.ty;
    });
  }

  private tick(dt: number): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    for (const l of this.lines) {
      l.t += dt;
      l.y += (l.ty - l.y) * Math.min(1, dt * 8);
      if (l.state === 'gather' && l.t > SPREAD + GATHER + 0.2) l.state = 'still';
      this.drawLine(l);
    }
    this.lines = this.lines.filter((l) => !(l.state === 'scatter' && l.t > 1.1));
  }

  private drawLine(l: Line): void {
    const { ctx } = this;
    const fade = l.dim ? 0.36 : 1;
    const w = this.W;
    const h = this.lh;
    if (l.t < 0) return;
    if (l.state === 'scatter') {
      // 흩어지기: 글자가 입자로 부서져 위로 번지며 사라짐
      const u = clamp(l.t / 1.0);
      ctx.globalAlpha = (1 - u * 3 > 0 ? 1 - u * 3 : 0) * fade;
      ctx.drawImage(l.sharp, 0, l.y, w, h);
      ctx.fillStyle = ink(0.8 * (1 - u) * fade);
      for (let i = 0; i < l.n; i += 2) {
        const o = i * 5;
        const e = u * u;
        const x = l.parts[o] + (l.parts[o + 2] - l.parts[o]) * e * 1.4;
        const y = l.parts[o + 1] + (l.parts[o + 3] - l.parts[o + 1]) * e * 1.4 - u * 18;
        ctx.fillRect(x, l.y + y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      return;
    }
    // 모이기: 입자가 날아와 글자가 되고, 지나간 자리부터 젖은 잉크로 맺힘
    const reveal = ((l.t - GATHER * 0.75) / SPREAD) * l.w;
    const dry = clamp((l.t - SPREAD - GATHER) / 1.4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, l.y - 4, Math.max(0, reveal), h + 8);
    ctx.clip();
    ctx.globalAlpha = (0.65 * (1 - dry) + 0.12) * fade;
    ctx.drawImage(l.wet, 0, l.y, w, h);
    ctx.globalAlpha = (0.55 + 0.45 * dry) * fade;
    ctx.drawImage(l.sharp, 0, l.y, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (l.state === 'gather') {
      for (let i = 0; i < l.n; i++) {
        const o = i * 5;
        const u = clamp((l.t - l.parts[o + 4]) / GATHER);
        if (u <= 0) continue;
        const e = ease3(u);
        const x = l.parts[o + 2] + (l.parts[o] - l.parts[o + 2]) * e;
        const y = l.parts[o + 3] + (l.parts[o + 1] - l.parts[o + 3]) * e;
        const a = Math.min(1, u * 2.5) * (x < reveal ? 0.25 : 0.85) * fade;
        if (a <= 0.02) continue;
        ctx.fillStyle = ink(a);
        const s = 1.2 + (1 - e) * 1.6;
        ctx.fillRect(x, l.y + y, s, s);
      }
    }
  }
}
