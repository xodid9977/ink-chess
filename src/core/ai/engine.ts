// 컴퓨터 상대: 난이도 1~5 → 엔진 레벨 0~4. 계산은 Web Worker에서.
export const LEVELS: { n: number; name: string; desc: string }[] = [
  { n: 1, name: '어린 필사생', desc: '거의 아무렇게나 둔다' },
  { n: 2, name: '견습 기사', desc: '한두 수 앞을 본다' },
  { n: 3, name: '숙련된 기사', desc: '몇 수 앞을 내다본다' },
  { n: 4, name: '늙은 현자', desc: '깊이 생각한다 (몇 초)' },
  { n: 5, name: '일기장의 주인', desc: '가장 깊이 읽는다 (오래 걸릴 수 있다)' },
];

export interface AiResult { from: string; to: string }

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: AiResult | null) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; from?: string; to?: string; error?: string }>) => {
      const cb = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      cb?.(e.data.from && e.data.to ? { from: e.data.from, to: e.data.to } : null);
    };
    worker.onerror = () => {
      for (const cb of waiting.values()) cb(null);
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** 난이도(1~5)로 다음 수 계산. 실패하면 null */
export function think(fen: string, level: number): Promise<AiResult | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++seq;
  return new Promise((res) => {
    waiting.set(id, res);
    w.postMessage({ id, fen, level: Math.max(0, Math.min(4, level - 1)) });
  });
}
