# Codex 단계별 지시문

## 사용법 (중요 — Codex가 "잘 안 해주는" 이유 대부분이 여기서 해결됩니다)
1. **한 번에 전부 시키지 마세요.** 아래 Phase를 **하나씩** 붙여넣고, 결과를 브라우저에서 확인한 뒤 다음으로 넘어갑니다.
2. 저장소 루트에 `AGENTS.md`, `docs/01_기획서.md`, `docs/02_에셋_목록.md`를 먼저 넣어 두세요. Codex는 `AGENTS.md`를 자동으로 읽습니다.
3. 프롬프트마다 **"완료 기준"**이 있습니다. Codex가 끝났다고 하면 그 항목을 하나씩 직접 확인하세요.
4. 마음에 안 들면 "다시 해"가 아니라 **무엇이 어떻게 다른지** 구체적으로: "불법 이동 시 말이 되돌아올 때 튕김이 너무 약함. elastic 강도 2배, 흔들림 3회로" 처럼.
5. Phase 하나가 끝나면 git 커밋 → 망가져도 되돌릴 수 있게.

---

## Phase 0 — 프로젝트 세팅
```
AGENTS.md와 docs/01_기획서.md를 읽고 프로젝트를 초기화해 줘.

할 일:
- Vite + TypeScript(strict) 프로젝트 생성
- 의존성: pixi.js@8, gsap@3, chess.js, js-chess-engine, howler, 개발용 vitest, eslint, prettier, @playwright/test
- AGENTS.md의 폴더 구조대로 빈 파일/폴더 생성 (각 파일에 역할 주석 한 줄)
- src/config/theme.ts에 기획서 2.2 팔레트 HEX와 기본 타이밍 상수 정의
- Pixi Application을 띄우고, 화면 전체에 양피지 색(#EFE3C8) 배경 + 가장자리 비네팅
- 창 크기 변경 시 캔버스가 맞춰지도록
- npm scripts: dev, build, test, lint

완료 기준:
- npm run dev 실행 시 양피지 배경 화면이 뜬다
- npm run build / test / lint 모두 성공
```

## Phase 1 — 플레이 가능한 체스 (플레이스홀더 그래픽)
```
Phase 1을 진행해 줘. 아직 이미지 에셋은 없으니 assets/manifest.ts의 플레이스홀더(진영 색 원 + 말 글자)로 그려.

1) core/game.ts: chess.js 래퍼. selectSquare, tryMove(from,to,promotion?), undo, reset.
   결과를 core/events.ts 이벤트로 발행: 'select','move','illegal','capture','check','checkmate','draw','promotionNeeded'.
   core/는 pixi/gsap를 import하지 않는다.
2) core/illegalReason.ts: 불법 이동 이유를 'notYourTurn' | 'blocked' | 'pinned' | 'leavesKingInCheck' | 'invalidPattern'으로 판별.
   chess.js에 가상의 수를 넣어 보는 방식으로 구현. Vitest 테스트 최소 6케이스.
3) render/board.ts: 8x8 칸. 밝은 칸 #EFE3C8, 어두운 칸 #C9B08A 계열. 화면 짧은 변의 85% 크기, 가운데.
4) 입력: 클릭-클릭 + 드래그앤드롭 둘 다.
   - 내 말 선택 시 y -8px 들어 올림(150ms), 이동 가능 칸에 금빛(#C9962E) 점, 잡기 가능 칸은 붉은 원 테두리
5) 합법 이동: 일단 직선 tween 250ms.
6) ★불법 이동 모션 render/motions/illegalBounce.ts:
   - 목표 방향으로 거리의 50%까지 200ms ease-out 이동
   - 도달 순간 scaleX 1.15 / scaleY 0.85 squash 80ms + 회색 먹 원이 퍼졌다 사라짐
   - 원래 칸으로 350ms elastic.out(1, 0.5) 복귀
   - 좌우 흔들림(rotation ±0.12rad) 2회
   - 드래그로 놓은 경우는 놓은 위치에서 바로 복귀 단계부터
   - 수치는 전부 config/pieces.ts
7) 애니메이션 중 입력 잠금.
8) 프로모션 선택 UI (Q/R/B/N 4개 버튼), 체크 시 킹 칸 붉게 깜빡임, 체크메이트/무승부 시 결과 텍스트.
9) 되돌리기, 새 게임 버튼.

완료 기준:
- 두 사람이 한 판을 끝까지 규칙대로 둘 수 있다 (캐슬링, 앙파상, 프로모션 포함)
- 불법 칸 클릭 시 '갔다가 되돌아오는' 모션이 보인다
- illegalReason 테스트 통과
```

## Phase 2 — 이동 모션 & 수채화 질감
```
Phase 2를 진행해 줘. 기획서 2.3, 4.2, 4.6을 참고.

1) config/pieces.ts에 말별 이동 모션 정의, render/motions/move.ts에서 사용:
   폰: 280ms, 작은 통통 튐 2회 / 나이트: 450ms 포물선 점프(높이 = 칸 크기 0.8배), 그림자는 바닥에 남음
   비숍: 350ms 활주 + 잔상 3개(알파 0.3→0) / 룩: 400ms 직선, 도착 시 stage 흔들림 4px 120ms
   퀸: 380ms 활주 + rotation 한 바퀴 / 킹: 400ms 한 걸음
2) 도착 시 fx/inkSplash.ts로 잉크 착지 얼룩(진영 색, 퍼졌다 600ms에 걸쳐 바램)
3) 이동 경로에 옅은 잉크 선(trail) → 1초 후 바램
4) fx/watercolorFilter.ts: Pixi DisplacementFilter + 노이즈 텍스처(코드로 생성)로
   말 가장자리가 2~3px 천천히 일렁이게. 종이 그레인은 화면 전체에 은은한 노이즈 오버레이.
   설정에서 끌 수 있게 (저사양 대비).
5) render/motions/autoSlide.ts: AI의 수, Undo(역재생), 새 게임 정렬(말마다 20ms 시차 웨이브) — 기획서 4.6
6) 선택 시 금빛 점이 칸마다 30ms 시차로 번지며 등장(scale 0→1 + alpha)

완료 기준:
- 말 종류마다 이동 느낌이 확연히 다르다
- 60fps 유지 (Chrome 성능 탭 확인)
- 필터 ON/OFF 토글 동작
```

## Phase 3 — 결투 컷신 시스템 ★
```
Phase 3을 진행해 줘. 기획서 5장 전체가 명세야. 아직 큰 일러스트가 없으니
컷신용 플레이스홀더는 말 글자가 크게 쓰인 도형 + 파츠(머리/몸/무기)를 사각형으로 나눠 그려.

1) config/combat.ts (데이터 주도, if/else 금지):
   attackByPiece: p→pierce, n→charge, b→magic, r→crush, q→slash, k→cleave
   reactionByAttack: pierce→pierced, charge→knockback, magic→dissolve, crush→shatter, slash→split, cleave→split
   vfxByAttack: 직선 잉크 분사 / 충격파 링 / 소용돌이 / 먹 폭발 / 참격선
   specials: { 'p>q': pawnVsQueen, 'p>p': pawnClash, 'n>n': knightJoust, 'q>q': queenDuel, enPassant: sideStab }
   resolveCombat(attacker, victim, flags) 함수 + 30개 조합 전부 결과가 나오는지 Vitest 테스트
2) cutscene/director.ts: GSAP 마스터 타임라인 조립. 구간(기획서 5.4):
   접근 0.25s(히트스톱) → 줌인 2.5배 + 잉크 번짐 전환 0.25s → 대치 0.3s → 공격 0.5s(중간 0.15s 슬로모 0.3배)
   → 리액션 0.5s → 복귀 0.2s. 전체 길이는 config로 스케일 가능.
3) attacks/*, reactions/*: 각각 (tl, attackerView, victimView, opts) => void 형태의 함수.
   split: 피해자를 사선 마스크 2장으로 나눠 위쪽은 미끄러져 떨어지고 단면에서 잉크 파티클.
   dissolve: 알파+변위 증가로 선부터 녹아 사라짐. shatter: 6~10조각으로 쪼개 흩날림.
   knockback: 회전하며 화면 밖. pierced: 뒤로 넘어지며 녹음.
4) fx/transitions.ts: 잉크 번짐 마스크 전환(노이즈 임계값 애니메이션으로 원형이 아닌 불규칙한 번짐).
5) 스킵: 클릭/스페이스/Esc → timeline.progress(1), 상태 정확히 일치.
6) 설정: 컷신 항상 / 짧게(전체 1초로 스케일) / 끄기(보드 위 잉크 터짐만).
7) 같은 조합 반복 시 좌우 반전·카메라 각도 3종 랜덤.
8) 체크메이트 피날레(기획서 4.5) — 킹이 왕관 내려놓고 바래짐 → 결과 화면.
9) prefers-reduced-motion 시 흔들림 OFF + 기본값 '짧게'.
10) 개발용 디버그 패널 (?debug=1): 공격자/피해자 드롭다운으로 아무 조합이나 즉시 재생.

완료 기준:
- 디버그 패널로 30개 조합 + 특수 5개 전부 재생 가능, 에러 없음
- 실제 게임에서 잡기 시 컷신이 나오고, 끝나면 잡힌 말이 묘지로 간다
- 스킵 후 보드 상태가 정상
```

## Phase 4 — 일기장 해설, UI, 사운드
```
Phase 4를 진행해 줘. 기획서 6, 7, 8장 참고.

1) ui/diary.ts: 보드 옆(모바일은 아래) 일기장 여백. 문장을 SVG 텍스트로 그리고
   stroke-dasharray 애니메이션으로 '한 획씩 써지는' 효과(글자당 40ms). 새 문장이 오면 이전 문장은 1.2초에 걸쳐 바램.
   폰트: Nanum Pen Script(한글), Dancing Script(영문) — Google Fonts.
   (stroke 애니가 한글 폰트에서 어색하면 대안: 글자마다 clip-path 좌→우 와이프)
2) 해설 템플릿 (ui/commentary.ts): 이동, 잡기("청색 기사가 e5의 병사를 쓰러뜨렸다."), 체크, 불법 이동 이유별 문장
   (blocked: "그 길은 막혀 있다." / pinned: "그 병사는 움직일 수 없다. 왕을 지키고 있다." / leavesKingInCheck: "왕이 위험하다…").
   각 상황마다 문장 3개 중 랜덤.
3) ui/graveyard.ts: 잡힌 말이 잉크 얼룩 위에 작게 쌓임. ui/moveLog.ts: 기보(SAN) 손글씨 목록.
4) 타이틀 화면(일기장 표지, 제목이 한 획씩 써짐) → 모드 선택(2인 / AI + 진영 + 난이도) → 게임 → 결과 화면.
5) audio/sound.ts: Howler. 에셋 목록의 사운드 키 사용, 파일 없으면 무음. 마스터/효과/BGM 볼륨 설정 + localStorage 저장(try/catch).
6) 설정 패널: 컷신 모드, 수채 필터, 사운드, 해설 ON/OFF.

완료 기준:
- 불법 이동 시 이유에 맞는 해설이 써진다
- 타이틀 → 게임 → 결과 → 다시하기 흐름이 끊김 없이 동작
```

## Phase 5 — AI 상대 & 실제 에셋 교체
```
Phase 5를 진행해 줘.

1) core/ai/worker.ts: js-chess-engine을 Web Worker에서 실행. 난이도 쉬움/보통/어려움 = level 1/2/3.
   AI 수는 최소 600ms 생각 시간 후 autoSlide로 이동(기획서 4.6: 목적 칸에 잉크 점 예고 0.3초).
2) public/assets/에 docs/02_에셋_목록.md 규격의 파일이 들어왔어. assets/manifest.ts가 실제 파일을 쓰도록 하고,
   없는 파일만 플레이스홀더로 폴백. 로딩 화면(잉크 방울이 차오르는 진행 바) 추가.
3) 컷신 파츠 PNG(head/body/weapon/legs + pivot JSON)로 컷아웃 애니메이션 연결.
4) 스프라이트 시트 VFX(잉크 스플래시 등)는 Pixi AnimatedSprite로 교체.

완료 기준:
- AI와 한 판을 끝까지 둘 수 있다, UI가 AI 생각 중에 멈추지 않는다
- 실제 아트로 보드·말·컷신이 표시된다, 빠진 파일이 있어도 게임이 깨지지 않는다
```

## Phase 6 — 폴리싱 (선택)
```
Phase 6을 진행해 줘.
- 모바일 세로 레이아웃(보드 = 화면폭-32px, 해설 아래), 터치 드래그
- 특수 조합 컷신 아트 적용
- 성능: 저사양 감지 시 파티클 50%, 필터 OFF
- (옵션) LLM 해설: .env의 OPENAI 호환 키가 있으면 수마다 한 줄 코멘트를 받아 일기장에 손글씨로.
  키는 클라이언트에 노출되면 안 되므로 작은 프록시 서버(server/)를 통해서만 호출. 없으면 템플릿 해설 유지.
```

---

## 문제 생겼을 때 쓰는 짧은 지시문
- **멈춤/버그:** "X를 하면 Y가 돼야 하는데 Z가 됨. 재현 순서: 1) … 2) …. 원인 먼저 설명하고 고쳐 줘. 테스트도 추가해."
- **모션 느낌 조정:** "config/pieces.ts의 knight 점프 높이 0.8 → 1.2, 시간 450 → 520ms로."
- **범위 초과 방지:** "이번에는 cutscene/reactions/split.ts만 수정해. 다른 파일은 건드리지 마."
- **설명 요청:** "코드 수정하지 말고 현재 컷신 director 구조를 설명만 해 줘."
