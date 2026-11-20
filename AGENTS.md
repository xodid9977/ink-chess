# AGENTS.md — Ink & Quill Chess

Codex(및 기타 코딩 에이전트)가 이 저장소에서 작업할 때 **항상 먼저 읽는** 규칙 파일입니다.
게임 전체 기획은 `docs/01_기획서.md`, 에셋 규격은 `docs/02_에셋_목록.md`를 참고하세요.

> ✅ **v3 — 실제 구현이 들어왔습니다 (2026-11-20).** 아래 문서보다 **코드가 우선**입니다.
> - 렌더링은 PixiJS가 아니라 **Canvas 2D**(잉크 질감을 픽셀 단위로 굽기 위해). 규칙은 chess.js, 시간 연출은 GSAP 그대로.
> - 실제 폴더: `src/render`(종이·말 굽기·월드), `src/fx`(잉크 방울/얼룩·깃펜 획·조각), `src/cutscene`(attacks.ts·reactions.ts·director.ts), `src/motion/moves.ts`, `src/core/game.ts`, `src/ui/panel.ts`, `src/audio/sfx.ts`.
> - 결투 수치를 바꿀 땐 `src/cutscene/attacks.ts`의 각 공격 함수 안 시간(초)·각도만 고치세요. 새 공격은 `ATTACKS`에, 새 리액션은 `REACTIONS`에 추가.
> - 개발 서버에서 `window.__ink.step(초)`로 프레임 단위 검사 가능.
>
> ⚠️ **v2 방향 수정 적용 중 — `docs/04_수정_프롬프트_v2.md`가 다른 문서와 충돌하면 v2가 우선.**
> - 말 = 실제 체스 말(스탠턴형) 모양. 캐릭터/치비/얼굴/팔다리 금지.
> - 진영 = 전통 백/흑 (백: 펜 선 + 옅은 칠, 흑: 진한 먹 칠). 금색은 포인트 전용.
> - 모든 그림은 `fx/ink/` 잉크 파이프라인(불규칙 펜 선, multiply 물감, 해칭, 10fps 계단식 보일링)을 거친다.
> - 컷신 무기·효과는 "보이지 않는 깃펜"이 획 단위로 그린다. 모든 공격은 예비→동작→히트스톱→여운 4박자.

## 프로젝트 요약
마법 일기장 위에 펜과 잉크로 그려진 체스 말들이 움직이는 웹 체스 게임.
- 합법 이동: 말 종류별 곡선 모션
- 불법 이동: 목표 방향으로 40~60% 갔다가 탄성 있게 원위치로 되돌아옴
- 잡기: 카메라 줌인 → 결투 컷신(공격 모션 + 임팩트 VFX + 피해자 리액션) → 보드 복귀

## 기술 스택 (변경 금지, 바꾸려면 먼저 제안)
- Vite + TypeScript (strict)
- PixiJS v8 — 모든 보드/말/이펙트 렌더링
- GSAP 3 — 모든 시간 기반 애니메이션 (setTimeout/requestAnimationFrame 직접 사용 금지)
- chess.js — 체스 규칙의 **유일한** 출처. 합법 수를 직접 계산하지 말 것
- js-chess-engine — AI 상대 (Web Worker에서 실행)
- Howler.js — 사운드
- Vitest — 단위 테스트, Playwright — 스모크 테스트

## 폴더 구조
```
src/
  main.ts                 # 앱 부트스트랩
  config/
    theme.ts              # 팔레트, 타이밍 상수 (매직 넘버 금지, 여기 모으기)
    pieces.ts             # 말별 이동 모션 파라미터
    combat.ts             # 공격 타입·리액션·특수 조합 매핑 (데이터 주도)
    pieceProfiles.ts      # 스탠턴 말 회전체 반쪽 윤곽선 (v2)
    ink.ts                # 잉크 파이프라인 수치 (v2)
    acting.ts, choreo.ts  # 딱딱한 말 연기 규칙, 결투 안무 수치 (v2)
  core/
    game.ts               # chess.js 래퍼, 게임 상태, 이벤트 발행
    events.ts             # 타입 있는 이벤트 버스 (move, illegal, capture, check, mate...)
    illegalReason.ts      # 불법 이동 이유 판별 (blocked / pinned / inCheck / notYourTurn)
    ai/worker.ts          # AI Web Worker
  render/
    stage.ts              # Pixi Application, 리사이즈, 카메라(줌/팬)
    board.ts              # 8x8 칸, 하이라이트
    pieceView.ts          # 말 스프라이트, 선택/들기/착지
    motions/              # move.ts, illegalBounce.ts, autoSlide.ts
  fx/
    ink/                  # (v2) 종이·물감·해칭·펜선·보일링·후처리 필터, quillDraw, InkDropSystem
    watercolorFilter.ts   # (v1, ink/로 대체)
    inkSplash.ts          # 잉크 방울/얼룩 파티클
    transitions.ts        # 잉크 번짐 마스크 전환
  cutscene/
    director.ts           # 컷신 타임라인 조립·재생·스킵
    attacks/              # pierce.ts, charge.ts, magic.ts, crush.ts, slash.ts, cleave.ts
    reactions/            # pierced.ts, knockback.ts, dissolve.ts, shatter.ts, split.ts
    specials/             # pawnVsQueen.ts, knightJoust.ts ...
  ui/
    diary.ts              # 한 획씩 써지는 해설 (SVG stroke-dasharray)
    graveyard.ts, moveLog.ts, settings.ts, promotionPicker.ts
  audio/sound.ts
  assets/manifest.ts      # 에셋 키 → 파일 경로. 파일이 없으면 플레이스홀더로 폴백
public/assets/            # 실제 이미지/사운드 (docs/02_에셋_목록.md 규격)
tests/
```

## 아키텍처 규칙
1. **로직과 연출 분리.** `core/`는 Pixi/GSAP를 import하지 않는다. 연출은 이벤트를 구독해서 재생한다.
2. **상태는 즉시, 연출은 나중.** chess.js 상태는 수가 확정되는 즉시 갱신하고, 애니메이션이 끝날 때까지 입력만 잠근다(`inputLocked`).
3. **컷신은 데이터 주도.** `config/combat.ts`에서 `(attacker, victim) → { attack, reaction, vfx, special? }`를 조회. 30개 조합을 if/else로 하드코딩하지 말 것.
4. **플레이스홀더 우선.** 에셋 파일이 없으면 `assets/manifest.ts`가 Pixi Graphics로 그린 대체 도형(원 + 글자 P/N/B/R/Q/K, 진영 색)을 반환. 에셋 교체 = 파일만 넣으면 되도록.
5. **모든 컷신은 스킵 가능** (클릭/스페이스/Esc) 하고, 스킵 시 최종 상태로 정확히 점프 (`timeline.progress(1)`).
6. `prefers-reduced-motion` 존중: 화면 흔들림 OFF, 컷신 기본값 "짧게".
7. 타이밍·색·거리 수치는 `config/`에만 둔다.

## 코드 규칙
- TypeScript strict, `any` 금지. 말 종류는 `type PieceType = 'p'|'n'|'b'|'r'|'q'|'k'` (chess.js와 동일).
- 파일 하나 300줄 넘기지 않기.
- 주석·UI 문구는 한국어 OK, 식별자는 영어.
- 새 라이브러리 추가 전 이유를 PR 설명에 적기.

## 완료 기준 (매 작업마다)
- `npm run build` 성공, `npm run test` 통과, `npm run lint` 경고 0
- 새 로직에는 Vitest 테스트 추가 (특히 `illegalReason`, `combat` 매핑)
- 브라우저에서 직접 확인한 내용을 작업 요약에 적기
- 60fps 유지 (컷신 중 프레임 드랍 시 파티클 수를 `theme.ts`에서 조절)

## 하지 말 것
- 체스 규칙 직접 구현
- 에셋을 코드에 base64로 박기
- 이 문서의 스택/구조를 묻지 않고 변경
- Stockfish(GPL-3) 추가 — 라이선스 검토 전 금지
