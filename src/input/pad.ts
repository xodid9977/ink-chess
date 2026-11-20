// 필기 패드: 펜·손가락으로 종이에 쓰는 잉크 + 사각사각 소리. 펜을 떼고 잠시 멈추면 onDone 호출
import { pen } from '../audio/sfx';
import { inkA } from '../config';
import type { Stroke } from './recognizer';

export class InkPad {
  strokes: Stroke[] = [];
  onDone: (strokes: Stroke[]) => void = () => undefined;
  idleMs = 900;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cur: Stroke | null = null;
  private last = { x: 0, y: 0, t: 0, w: 2 };
  private timer = 0;
  private penOnly = false;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    const c = cv.getContext('2d');
    if (!c) throw new Error('no 2d');
    this.ctx = c;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    cv.addEventListener('pointerup', (e) => this.up(e));
    cv.addEventListener('pointercancel', (e) => this.up(e));
    new ResizeObserver(() => this.resize()).observe(cv);
    this.resize();
  }

  resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.max(1, Math.round(r.width * this.dpr));
    this.cv.height = Math.max(1, Math.round(r.height * this.dpr));
    this.redraw();
  }

  clear(fade = true): void {
    window.clearTimeout(this.timer);
    this.strokes = [];
    if (!fade) { this.redraw(); return; }
    this.cv.classList.add('fading');
    window.setTimeout(() => { this.cv.classList.remove('fading'); if (!this.strokes.length) this.redraw(); }, 450);
  }

  private pos(e: PointerEvent): { x: number; y: number } {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    // S펜이 한 번이라도 쓰이면, 손바닥이 닿는 터치는 무시
    if (e.pointerType === 'pen') this.penOnly = true;
    if (this.penOnly && e.pointerType === 'touch') return;
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
    window.clearTimeout(this.timer);
    this.cv.classList.remove('fading');
    if (!this.strokes.length) this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    const p = this.pos(e);
    this.cur = [p];
    this.strokes.push(this.cur);
    this.last = { ...p, t: performance.now(), w: this.width(e, 0) };
    pen.start();
    this.dot(p.x, p.y, this.last.w);
  }

  private width(e: PointerEvent, speed: number): number {
    const pr = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return (1.4 + pr * 2.6) * (1.15 - Math.min(0.5, speed * 0.25));
  }

  private move(e: PointerEvent): void {
    if (!this.cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = this.pos(ev);
      const now = performance.now();
      const d = Math.hypot(p.x - this.last.x, p.y - this.last.y);
      if (d < 0.8) continue;
      const speed = d / Math.max(1, now - this.last.t);
      const w = this.last.w * 0.6 + this.width(ev, speed) * 0.4;
      this.seg(this.last.x, this.last.y, p.x, p.y, this.last.w, w);
      this.cur.push(p);
      pen.move(speed, ev.pointerType === 'pen' ? ev.pressure : 0.5);
      this.last = { ...p, t: now, w };
    }
  }

  private up(e: PointerEvent): void {
    if (!this.cur) return;
    this.cur = null;
    pen.stop();
    try { this.cv.releasePointerCapture(e.pointerId); } catch { /* 이미 해제됨 */ }
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.strokes.length) this.onDone(this.strokes.slice());
    }, this.idleMs);
  }

  private seg(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): void {
    const c = this.ctx;
    c.save();
    c.scale(this.dpr, this.dpr);
    c.lineCap = 'round';
    // 번짐(옅고 넓게) + 심(진하게)
    c.strokeStyle = inkA(0.12);
    c.lineWidth = (w0 + w1) * 0.5 + 2.2;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = inkA(0.9);
    c.lineWidth = (w0 + w1) * 0.5;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.restore();
  }

  private dot(x: number, y: number, w: number): void {
    const c = this.ctx;
    c.save();
    c.scale(this.dpr, this.dpr);
    c.fillStyle = inkA(0.9);
    c.beginPath(); c.arc(x, y, w * 0.55, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    for (const s of this.strokes) {
      for (let i = 1; i < s.length; i++) this.seg(s[i - 1].x, s[i - 1].y, s[i].x, s[i].y, 2.6, 2.6);
    }
  }
}
