// 별도 작업자에서 수 계산 (화면이 멈추지 않도록). js-chess-engine 레벨 0~4
import * as ns from 'js-chess-engine';

interface Engine { aiMove(fen: string, level?: number): Record<string, string> }
// 번들 방식에 따라 default 아래에 있거나 바로 있음
const engine = ((ns as unknown as { default?: Engine }).default ?? (ns as unknown as Engine));

interface Req { id: number; fen: string; level: number }

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, fen, level } = e.data;
  try {
    const mv = engine.aiMove(fen, level);
    const [from, to] = Object.entries(mv)[0] ?? [];
    self.postMessage({ id, from: from?.toLowerCase(), to: to?.toLowerCase() });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
