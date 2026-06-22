# UX Spec

Status: Draft
Version: v2.0.0
Last Updated: 2026-06-22
Owns: 화면 구조, 인터랙션, DAG 카드/리스트, 조작 패널
Depends On:
  - `01-product-flow.md`
  - `02-domain-model.md`
---

## UX Principle

MVP에서는 구현 안정성과 상태 명확성을 우선한다. DAG 시각화는 계층형 카드 리스트와 간단한 edge 표시를 기본으로 한다.

---

## Screens

```text
Home
Project Setup / Intake
Capstone Review
DAG Workspace
  - DAG Tree/List Panel
  - Current Node Cards
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

### 좌측: DAG 시각화

초기 구현에서는 복잡한 그래프 레이아웃보다 계층형 카드 리스트와 간단한 edge 표시를 우선한다.

표시 요소:

- 노드와 선수관계
- 상태별 구분: waiting, studying, completed, excluded, stale
- capstone 노드 별도 강조
- 현재 학습 가능한 ready node 표시
- prerequisite chips

추천 배치:

- 위쪽: ready node
- 가운데: waiting node
- 아래쪽: capstone

이유:

- DAG 레이아웃은 구현 난이도가 높다.
- 학습자에게 당장 중요한 것은 “지금 무엇을 공부할 수 있는가”다.
- 안정적인 제품은 예쁜 그래프보다 명확한 상태 전이가 먼저다.

### 중앙: 선택 노드 상세

- 이름
- 개요
- 선수 노드
- 후속 노드
- 상태
- 현재 TestGoal
- 최근 TestRecord 요약
- 학습 메모

### 우측: LLM 상호작용 / Patch Preview

자연어 명령 예시:

- “이 노드를 더 세분화해줘”
- “A와 B를 합쳐줘”
- “이 선수관계가 이상한데 다시 검토해줘”
- “내가 C는 이미 아니까 제외해줘”
- “전체 DAG를 더 단순하게 리팩토링해줘”

LLM 응답은 바로 적용하지 않고 Patch Preview로 보여준다.

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
