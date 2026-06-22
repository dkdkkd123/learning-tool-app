# UX Spec

Status: Draft
Version: v2.1.0
Last Updated: 2026-06-22
Owns: 화면 구조, 인터랙션, DAG 무한캔버스, 조작 패널
Depends On:
  - `01-product-flow.md`
  - `02-domain-model.md`
Related Changes:
  - `../changes/v2/v2.1.0-infinite-canvas-dag.md`

---

## UX Principle

DAG는 단순한 목록이 아니라 학습자의 지식 지도다. 따라서 기본 시각화는 조작 패널 안의 보조 UI가 아니라, 별도의 무한캔버스에서 제공한다.

> 무한캔버스는 그래프를 탐색하는 공간이고, 조작 패널은 선택한 대상에 행동을 수행하는 공간이다.

---

## Screens

```text
Home
Project Setup / Intake
Capstone Review
DAG Workspace
  - Infinite Canvas
  - Side Inspector
  - Command Panel
  - Patch Preview
Node Study
Test Runner
Test Result
Capstone Attempt
Achievement Log
```

---

## Home

- 새 학습 프로젝트 시작
- 기존 프로젝트 목록
- 프로젝트 상태 표시:
  - 캡스톤 검토 중
  - DAG 검토 중
  - 학습 중
  - 캡스톤 도전 가능
  - 완료

---

## Project Setup / Intake

입력 모드는 둘이다.

| 모드 | 입력 예시 | 다음 단계 |
|---|---|---|
| 학습 내용 | “복소해석학을 공부하고 싶다” | LLM이 canonical 캡스톤 2~3개 제안 |
| 캡스톤 | “유수 정리로 특정 이상적분을 계산하고 싶다” | LLM이 이진 성공 기준을 정제 |

입력 폼:

- 학습 내용 또는 캡스톤 문제
- 선호 출력 형태: 문제풀이 / 프로젝트 / 구현 / 증명 / 분석 / 자동
- 난이도 감각: 입문 / 보통 / 도전적 / 자동
- 이미 아는 것: 선택 입력
- 제외하고 싶은 범위: 선택 입력

---

## Capstone Review

LLM이 제안한 캡스톤을 카드로 보여준다.

각 카드:

- 캡스톤명
- 수행 내용
- 성공 기준
- 이 캡스톤이 해당 분야의 무엇을 대표하는지
- 예상 산출물
- 선택 / 수정 / 다시 제안

캡스톤이 확정되면 DAG 초안 생성을 시작한다.

---

## DAG Workspace

앱의 중심 화면이다.

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: project title, graph version, ready count, save state │
├───────────────────────────────────────┬──────────────────────┤
│                                       │ Side Inspector        │
│                                       │ - selected node       │
│         Infinite DAG Canvas           │ - prerequisites       │
│                                       │ - test goal           │
│                                       │ - actions             │
│                                       ├──────────────────────┤
│                                       │ Command Panel         │
│                                       │ - natural language    │
│                                       │ - patch preview       │
└───────────────────────────────────────┴──────────────────────┘
```

### Infinite DAG Canvas

DAG 시각화는 조작 패널과 분리된 무한캔버스에서 제공한다.

무한캔버스의 책임:

- pan / zoom
- 노드 선택
- 노드 위치 표시
- 노드 수동 배치
- edge 시각화
- 그래프 구조 탐색
- ready node 강조
- capstone node 강조
- stale node 표시
- 그래프 전체를 한눈에 보는 minimap 또는 fit-to-view

무한캔버스가 하지 않는 일:

- 노드 상세 편집
- LLM 명령 입력
- GraphPatch 승인
- 테스트 생성
- 학습 상태 변경

이 작업들은 조작 패널에서 처리한다.

### Node Visual States

| 상태 | 시각 표현 |
|---|---|
| waiting | 기본 노드 |
| ready | 강조 테두리 또는 ready badge |
| studying | 진행 중 표시 |
| completed | 완료 표시 |
| excluded | 흐리게 처리하거나 별도 레이어로 이동 |
| stale | 경고 badge |
| capstone | 일반 지식 노드와 다른 형태 또는 큰 노드 |

색상 자체에만 의미를 의존하지 않는다. badge, label, icon을 함께 사용한다.

### Canvas Interactions

| 인터랙션 | 동작 |
|---|---|
| 노드 클릭 | Side Inspector에 상세 표시 |
| 노드 더블클릭 | Node Study로 이동하거나 quick action 열기 |
| 노드 드래그 | canvas position만 변경. DAG edge 의미는 변경하지 않음 |
| edge 클릭 | 선수관계 상세 표시 |
| 빈 공간 드래그 | canvas pan |
| 휠/트랙패드 | zoom |
| Fit to graph | 전체 DAG가 보이도록 viewport 조정 |
| Focus ready nodes | 현재 학습 가능한 노드 영역으로 이동 |

수동 배치는 학습자의 공간 기억을 지원하기 위한 UI 상태다. 도메인 모델의 선수관계 의미와 분리한다.

### Side Inspector

선택 노드 상세를 보여준다.

- 이름
- 개요
- 선수 노드
- 후속 노드
- 상태
- 현재 TestGoal
- 최근 TestRecord 요약
- 학습 메모
- 액션:
  - 공부 시작
  - 테스트 시작
  - 더 쪼개기
  - 병합/수정
  - 제외

### Command Panel

자연어 명령 예시:

- “이 노드를 더 세분화해줘”
- “A와 B를 합쳐줘”
- “이 선수관계가 이상한데 다시 검토해줘”
- “내가 C는 이미 아니까 제외해줘”
- “전체 DAG를 더 단순하게 리팩토링해줘”

LLM 응답은 바로 적용하지 않고 Patch Preview로 보여준다.

### Patch Preview

GraphPatch 후보를 적용 전 보여준다.

```text
변경 요약
- 추가 노드 3개
- 삭제/제외 노드 1개
- 변경 edge 4개
- stale 처리될 테스트 2개

[적용] [폐기] [다시 요청]
```

Patch Preview에는 다음을 표시한다.

- 변경 전/후 노드
- 추가/삭제 edge
- stale 처리될 테스트
- domain validation 결과
- 적용 / 폐기 / 다시 요청

### Fallback View

카드 리스트는 기본 UX가 아니라 fallback으로 둔다.

사용처:

- 모바일 화면
- 접근성 모드
- 그래프 렌더링 실패
- 극도로 작은 프로젝트

fallback 리스트에서도 ready node, stale node, capstone은 명확히 표시한다.

---

## Node Study

하나의 지식 노드를 공부하는 화면.

구성:

- 노드 개요
- 이 노드의 학습 목표: TestGoal
- 학습 메모
- LLM 질의응답
- 테스트 시작
- 노드 분해 요청
- 이미 알고 있으므로 제외
- 학습 중 발견한 선수 지식 추가

노드 완료 조건:

```text
해당 노드의 TestGoal에서 요구한 난이도의 지식 이해 테스트를 통과한다.
```

---

## Test Runner

지식 이해 테스트 5유형을 지원한다.

중요 규칙:

- 유형 4는 항상 첫 번째로 출제한다.
- 한 문제를 제출하면 수정할 수 없다.
- 답안지는 학습자 제출 전 비공개다.
- 모든 문제는 풀이 과정을 요구한다.
- 채점은 정답 여부뿐 아니라 오개념 위치를 기록한다.

---

## Test Result

- 문제별 채점 결과
- 오개념 목록
- 정확히 이해된 부분
- 추가 학습 필요 부분
- 다음 시험 권장 난이도
- 노드 완료 가능 여부

---

## Capstone Attempt

모든 필수 노드가 완료되면 활성화된다.

화면 구성:

- 캡스톤 수행 내용
- 성공 기준
- 제출물 입력 / 업로드 / 링크
- 자기 판정 메모
- LLM 판정 보조
- 최종 상태:
  - achieved
  - failed
  - retry_needed

캡스톤 판정은 이진 기준으로 한다. 품질, 만족도, 아쉬움은 회고 필드에 남긴다.

---

## Achievement Log

캡스톤 달성 후 출력되는 최종 문서 화면.

포함 내용:

- 원래 입력
- 확정된 캡스톤과 성공 기준
- 최종 DAG
- DAG 주요 변경 이력
- 완료한 지식 노드 목록
- 노드별 지식 이해 테스트 결과
- 발견된 오개념과 해결 과정
- 캡스톤 시도 결과
- 다음 캡스톤 추천 또는 후속 학습 제안
