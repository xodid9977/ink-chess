// 전역 수치 모음 (흑백 잉크 v3)
export const S = 100; // 한 칸 = 100 월드 단위
export const BOARD = 8 * S;

export const INK: [number, number, number] = [20, 17, 15];
export const PAPER: [number, number, number] = [241, 238, 231];
export const inkA = (a: number): string => `rgba(${INK[0]},${INK[1]},${INK[2]},${a})`;
export const paperA = (a: number): string => `rgba(${PAPER[0]},${PAPER[1]},${PAPER[2]},${a})`;

export const ART = {
  R: 440, // 말 이미지 해상도(px / 칸)
  boilFrames: 3,
  boilFps: 10, // 선 떨림: 초당 10번 계단식
};

export const DUEL = {
  zoom: 3.15, // 결투 시 카메라 배율
  standGap: 0.95 * S, // 대치 거리
  battleStainAlpha: 0.12,
};

export type DuelMode = 'full' | 'short' | 'off';
