// js-chess-engine에는 타입 정의가 없어서 쓰는 부분만 선언
declare module 'js-chess-engine' {
  export function aiMove(fen: string, level?: number): Record<string, string>;
}
