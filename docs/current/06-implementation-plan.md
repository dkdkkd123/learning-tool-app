# Implementation Plan

Status: Draft
Version: v2.1.0
Last Updated: 2026-06-22
Owns: MVP 범위, 구현 순서, 후속 단계, 미결정 사항
Depends On:
  - `01-product-flow.md`
  - `02-domain-model.md`
  - `04-ux-spec.md`
  - `05-architecture.md`
Related Changes:
  - `../changes/v2/v2.1.0-infinite-canvas-dag.md`

---

## MVP Goal

MVP의 목표는 “캡스톤 중심 학습 프로젝트 하나를 만들고, 역추적 DAG를 무한캔버스에서 탐색하며, 노드별 이해 테스트를 통해 학습 진행과 성취 로그를 완성하는 것”이다.

---

## Phase 1 — Project + Capstone

필수:

1. Home 화면
2. 새 프로젝트 생성
3. 학습 내용/캡스톤 입력
4. LLM capstone proposal/refinement 호출
5. 캡스톤 후보 선택 또는 수정
6. StudyProject 저장

완료 기준:

- 학습 내용 입력 시 canonical capstone 후보가 생성된다.
- 캡스톤 입력 시 이진 성공 기준이 정제된다.
- 확정된 capstone이 project에 저장된다.

---

## Phase 2 — DAG Draft + Infinite Canvas

필수:

1. DAG 초안 생성
2. KnowledgeNode / Edge 저장
3. graph invariant validation
4. 초기 자동 레이아웃
5. 무한캔버스 렌더링
6. pan / zoom
7. 노드 선택
8. Side Inspector 표시
9. ready node 계산

완료 기준:

- 캡스톤에서 역추적한 지식 DAG가 생성된다.
- DAG가 조작 패널과 분리된 무한캔버스에 표시된다.
- 노드를 선택하면 우측 inspector에 상세 정보가 표시된다.
- 노드 드래그는 위치만 바꾸고 선수관계를 바꾸지 않는다.

---

## Phase 3 — GraphPatch Editing

필수:

1. 자연어 command 입력
2. LLM GraphPatch 후보 생성
3. schema validation
4. domain validation
5. Patch Preview
6. 사용자 승인 후 reducer 적용
7. graphVersion 증가
8. event log 저장

지원할 최소 operation:

- add_node
- update_node
- exclude_node
- add_edge
- remove_edge
- split_node

완료 기준:

- LLM이 제안한 DAG 변경이 바로 적용되지 않고 preview를 거친다.
- cycle이 생기는 patch는 적용되지 않는다.
- 적용된 patch는 event log에 남는다.

---

## Phase 4 — TestGoal + Test Runner

필수:

1. 노드별 TestGoal 생성
2. 시험지 생성
3. answerKey 분리 저장
4. TestRunner 화면
5. 유형 4 첫 번째 렌더링
6. 문제 제출 후 잠금
7. 마지막 제출 후 채점
8. TestRecord 저장
9. 통과 시 노드 완료 가능 처리

완료 기준:

- 각 노드는 테스트를 통해 완료된다.
- 답안지는 제출 전 노출되지 않는다.
- 테스트 기록이 다음 난이도 결정에 사용된다.

---

## Phase 5 — Capstone Attempt + Achievement Log

필수:

1. 모든 필수 노드 완료 시 capstone ready 표시
2. CapstoneAttempt 화면
3. 제출물/메모 입력
4. 이진 성공 판정
5. AchievementLog 생성
6. Markdown export

완료 기준:

- 캡스톤 달성 후 학습 성취 로그가 생성된다.
- 로그에는 최종 DAG, DAG 변화, 테스트 기록, 오개념 변화가 포함된다.

---

## MVP Includes

- 단일 캡스톤 프로젝트
- 캡스톤 후보 생성/정제
- 역추적 DAG 초안 생성
- 무한캔버스 DAG 시각화
- pan / zoom / node select / basic auto layout
- Side Inspector
- Command Panel
- GraphPatch preview/apply
- 노드별 TestGoal
- 지식 이해 테스트 생성/진행/채점
- 테스트 기록 저장
- 노드 완료 처리
- 캡스톤 달성 처리
- 학습 성취 로그 출력
- window.storage 저장/불러오기

---

## MVP Excludes

- 다중 캡스톤 통합
- 고급 자동 레이아웃
- 그래프 협업 편집
- 외부 자료 업로드 기반 학습
- 추천 자료 검색
- PDF export
- 모바일 최적화
- 복잡한 그래프 애니메이션

---

## Later — Graph Growth

1. 다중 캡스톤 추가
2. 기존 DAG와 새 DAG 통합 리팩토링
3. 중복 노드 감지
4. 장기 개인 지식 그래프
5. 그래프 리팩토링 히스토리
6. 더 정교한 성취 로그

---

## Later — Learning Experience

1. 학습 메모와 테스트 오개념 연결
2. 노드별 자료 추천
3. 캡스톤 산출물 자동 검증 보조
4. 그래프 미니맵 고도화
5. 학습 회고 타임라인
6. 지식 노드별 숙련도 추세

---

## Risks

| 리스크 | 대응 |
|---|---|
| 무한캔버스 구현 복잡도 | MVP는 pan/zoom/select/basic layout만 구현 |
| LLM patch 품질 불안정 | schema + domain validation + preview 적용 |
| DAG가 너무 복잡해짐 | ready node focus, fit-to-view, minimap, refactor command 제공 |
| TestGoal stale 처리 누락 | getAffectedDescendants 기반 자동 stale 처리 |
| 답안지 노출 | answerKey 분리 저장, TestRunner에서 visibility 확인 |

---

## Open Decisions

| 항목 | 기본 제안 | 이유 |
|---|---|---|
| 전체 시험 생성 시점 | 노드 학습 시작 시 생성 | DAG 수정 시 stale 문제가 적고 비용이 낮다 |
| TestGoal 생성 시점 | DAG 승인 직후 모든 active 노드에 생성 | 각 노드의 학습 목표를 초기에 명확히 한다 |
| 노드 완료 기준 | 초급 pass | baseline 우선 원칙과 맞다 |
| DAG 시각화 | 무한캔버스 우선 | 지식 지도의 공간적 탐색성과 성장성에 적합하다 |
| 카드 리스트 | fallback | 모바일·접근성·렌더링 실패 대응 |
| 답안지 저장 | exam과 분리 저장 | 제출 전 노출 방지 |
| LLM 변경 적용 | patch preview 후 사용자 승인 | 학습자 주도와 안정성 확보 |
| 다중 캡스톤 | 2차 구현 | MVP 복잡도 절감 |
