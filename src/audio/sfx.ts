// 합성 효과음 (에셋 없이 WebAudio 노이즈/톤으로)
let ac: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
export const audio = { on: true };

function ctx(): AudioContext | null {
  if (!audio.on) return null;
  if (!ac) {
    ac = new AudioContext();
    const len = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function noise(dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1): void {
  const a = ctx();
  if (!a || !noiseBuf) return;
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const flt = a.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 1): void {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** 펜이 종이를 긁는 '사각사각' — 펜 속도에 따라 커지고 작아짐 */
class PenScratch {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private flt: BiquadFilterNode | null = null;
  start(): void {
    const a = ctx();
    if (!a || !noiseBuf || this.src) return;
    this.src = a.createBufferSource();
    this.src.buffer = noiseBuf;
    this.src.loop = true;
    this.flt = a.createBiquadFilter();
    this.flt.type = 'bandpass';
    this.flt.frequency.value = 3200;
    this.flt.Q.value = 0.9;
    const hp = a.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    this.gain = a.createGain();
    this.gain.gain.value = 0.0001;
    this.src.connect(hp).connect(this.flt).connect(this.gain).connect(a.destination);
    this.src.start();
  }
  /** speed: px/ms 정도의 펜 속도, pressure: 0~1 */
  move(speed: number, pressure: number): void {
    if (!ac || !this.gain || !this.flt) return;
    const t = ac.currentTime;
    const s = Math.min(1, speed / 1.6);
    // 종이 결에 걸리는 거친 느낌: 매번 살짝 다른 크기
    const g = (0.03 + 0.16 * s) * (0.6 + 0.6 * pressure) * (0.7 + Math.random() * 0.6);
    this.gain.gain.setTargetAtTime(g, t, 0.012);
    this.flt.frequency.setTargetAtTime(2400 + 2600 * s + Math.random() * 500, t, 0.02);
  }
  stop(): void {
    if (!ac || !this.src || !this.gain) return;
    const t = ac.currentTime;
    this.gain.gain.setTargetAtTime(0.0001, t, 0.03);
    this.src.stop(t + 0.2);
    this.src = null;
    this.gain = null;
    this.flt = null;
  }
}
export const pen = new PenScratch();

export const sfx = {
  /** 말이 종이 위를 미끄러지는 소리 */
  slide: (dur: number): void => {
    const a = ctx();
    if (!a || !noiseBuf) return;
    const t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const flt = a.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 0.7;
    flt.frequency.setValueAtTime(700, t);
    flt.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    flt.frequency.linearRampToValueAtTime(600, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(a.destination);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  },
  tap: (): void => noise(0.06, 'bandpass', 2400, 1800, 0.25, 3),
  scratch: (): void => noise(0.22, 'bandpass', 3800, 2600, 0.08, 2),
  thud: (k = 1): void => { noise(0.25 * k, 'lowpass', 600, 80, 0.5 * k); tone(90, 0.2 * k, 0.3 * k, 'sine', 0.5); },
  bonk: (): void => { noise(0.08, 'lowpass', 900, 200, 0.35); tone(160, 0.12, 0.2, 'triangle', 0.7); },
  page: (): void => noise(0.45, 'highpass', 1200, 5000, 0.12, 0.7),
  whoosh: (): void => noise(0.28, 'bandpass', 500, 3200, 0.22, 1.2),
  stab: (): void => { noise(0.09, 'highpass', 3000, 1500, 0.4); noise(0.3, 'lowpass', 1200, 200, 0.3); },
  slash: (big = false): void => { noise(big ? 0.4 : 0.22, 'bandpass', 6000, 1200, big ? 0.5 : 0.32, 2); },
  crush: (): void => { noise(0.7, 'lowpass', 900, 40, 0.9); tone(55, 0.6, 0.5, 'sine', 0.6); },
  splat: (): void => noise(0.18, 'lowpass', 1600, 300, 0.3, 2),
  drip: (): void => tone(900 + Math.random() * 500, 0.12, 0.1, 'sine', 0.45),
  magic: (): void => { tone(330, 0.9, 0.08, 'triangle', 2); tone(495, 0.9, 0.06, 'sine', 1.5); },
  swell: (): void => { tone(65, 1.1, 0.25, 'sawtooth', 1.3); noise(1.0, 'lowpass', 200, 900, 0.08); },
  check: (): void => tone(98, 0.8, 0.2, 'sawtooth', 0.97),
};
