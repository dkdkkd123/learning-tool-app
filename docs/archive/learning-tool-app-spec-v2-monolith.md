# 학습 도구 앱 기획 문서 v2

> 이 문서는 `learning-scope-decomposition` v2와 `knowledge-understanding-test` v3를 통합한 학습 도구 앱의 구현 기획이다.
> 핵심 방향은 **캡스톤 중심 학습**, **역추적 지식 DAG**, **노드별 지식 이해 테스트**, **학습 중 DAG 리팩토링**, **성취 로그 출력**이다.

---

## 0. v2 변경 요약

기존 문서는 “학습 주제 → 범위 분할 → 테스트” 구조였다.  
v2에서는 앱의 중심 객체를 **학습 범위 문서**가 아니라 **캡스톤 기반 학습 프로젝트**로 바꾼다.

| 기존 구조 | v2 구조 |
|---|---|
| 학습 주제에서 범위를 분할 | 캡스톤에서 역추적해 지식 DAG 생성 |
| 트리 중심 탐색 | 선수관계가 있는 DAG 중심 탐색 |
| 노드를 확정한 뒤 테스트 생성 | 각 지식 노드의 학습 목표가 곧 지식 이해 테스트 |
| 모듈 A/B가 문서로만 연결 | 하나의 프로젝트 안에서 DAG, 테스트, 기록, 로그가 연결 |
| 범위 문서 출력 | 캡스톤 달성 후 학습 성취 로그 출력 |
| 초기 분할 결과 중심 | 학습 중 편집·분해·병합·리팩토링되는 살아있는 DAG |

---

## 1. 앱 개요

### 목적

학습자가 학습하고 싶은 내용 또는 풀고 싶은 캡스톤 문제를 입력하면, 앱은 다음을 수행한다.

1. 학습 내용을 **이진 성공 기준이 있는 캡스톤 문제 또는 프로젝트**로 구체화한다.
2. 캡스톤 달성에 필요한 지식을 역추적하여 **선수관계 DAG 초안**을 만든다.
3. 각 지식 노드마다 **지식 이해 테스트**를 생성하고, 이를 해당 노드의 학습 목표로 삼는다.
4. 학습 중 학습자와 LLM이 상호작용하며 DAG를 계속 수정한다.
5. 캡스톤 달성 후 전체 학습 과정과 성취를 **학습 성취 로그**로 출력한다.

### 핵심 가치

- **캡스톤 우선**: 학습의 끝은 “많이 공부했다”가 아니라 “구체적 과제를 수행했다”로 판단한다.
- **이진 성공 기준**: 캡스톤은 성공/실패가 판정 가능해야 한다. 품질 평가는 별도의 만족도나 회고로 남긴다.
- **역추적 DAG**: “이걸 하려면 무엇을 알아야 하는가?”를 재귀적으로 물어 지식 노드를 만든다.
- **테스트가 곧 학습 목표**: 각 노드는 “이 개념을 안다”가 아니라 “이 지식 이해 테스트를 통과한다”로 완료된다.
- **살아있는 그래프**: DAG는 초안일 뿐이며 학습 중 언제든 분해, 병합, 제외, 선수관계 수정, 전체 리팩토링이 가능하다.
- **간단한 결정론 + LLM 제안**: LLM은 후보를 제안하고, 앱의 도메인 로직은 검증·적용·저장을 담당한다.

---

## 2. 전체 서비스 로직

```text
[1] 입력
    ├─ 학습 내용 입력
    └─ 캡스톤 문제/프로젝트 입력

[2] 캡스톤 확정
    ├─ 학습 내용이면 LLM이 canonical 문제/프로젝트 제안
    └─ 캡스톤이면 이진 성공 기준을 정제

[3] DAG 초안 생성
    └─ 캡스톤에서 역추적해 지식 노드와 선수관계 생성

[4] 노드별 지식 이해 테스트 생성
    └─ 각 지식 노드의 baseline 학습 목표로 저장

[5] 학습 진행
    ├─ 선수관계상 학습 가능한 노드 선택
    ├─ 자료 학습, 메모, LLM 질의응답
    └─ 지식 이해 테스트 통과 시 노드 완료

[6] DAG 반복 수정
    ├─ 노드 분해
    ├─ 노드 병합
    ├─ 노드 제외
    ├─ 선수관계 수정
    └─ 전체 리팩토링

[7] 캡스톤 도전
    └─ 모든 필수 선수 노드 완료 후 캡스톤 수행

[8] 학습 성취 로그 출력
    └─ 목표, DAG 변화, 테스트 기록, 오개념 변화, 캡스톤 결과를 문서화
```

### 중요한 구현 원칙

LLM이 앱 상태를 직접 바꾸게 하지 않는다.  
LLM은 항상 **제안서**를 반환하고, 앱은 이를 **검증 가능한 GraphPatch**로 변환한 뒤 reducer가 적용한다.

```text
사용자/LLM 제안
    ↓
GraphPatch 후보
    ↓
도메인 검증
    - 노드 ID 유효성
    - DAG 순환 여부
    - 선수관계 유효성
    - 상태 전이 가능 여부
    - 캡스톤 도달 가능성
    ↓
applyGraphPatch()
    ↓
version 증가 + event log 저장
```

이 구조가 단순하지만 강력하다. 복잡한 자동 계획 알고리즘보다, **작은 patch와 강한 불변조건**이 앱을 안정시킨다.

---

## 3. 핵심 도메인 모델

### 3.1 StudyProject

앱의 최상위 단위. 하나의 학습 여정을 의미한다.

```ts
type StudyProject = {
  id: string;
  title: string;
  inputMode: 'learning_content' | 'capstone';
  originalInput: string;

  status:
    | 'intake'
    | 'capstone_review'
    | 'dag_review'
    | 'learning'
    | 'capstone_ready'
    | 'completed'
    | 'archived';

  capstones: CapstoneNode[];
  nodes: Record<NodeId, KnowledgeNode>;
  edges: Edge[];

  activeCapstoneId: string;
  graphVersion: number;

  testGoals: Record<NodeId, TestGoal>;
  testRecords: Record<TestRecordId, TestRecord>;

  events: ProjectEvent[];
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 CapstoneNode

캡스톤도 DAG의 노드다. 다만 상태와 완료 기준이 다르다.

```ts
type CapstoneNode = {
  id: string;
  kind: 'capstone';
  title: string;
  description: string;
  successCriteria: string; // 이진 판단 가능해야 함
  outputType: 'problem_solution' | 'project' | 'analysis' | 'implementation' | 'proof' | 'other';

  prerequisiteNodeIds: NodeId[];
  status: 'waiting' | 'ready' | 'attempting' | 'achieved' | 'failed';

  attemptLogs: CapstoneAttemptLog[];
};
```

### 3.3 KnowledgeNode

```ts
type KnowledgeNode = {
  id: string;
  kind: 'knowledge';
  name: string;
  summary: string; // 2~4문장
  prerequisiteNodeIds: NodeId[];

  status: 'waiting' | 'studying' | 'completed' | 'excluded';

  testGoalStatus: 'none' | 'generating' | 'ready' | 'stale' | 'retired';
  currentTestGoalId?: string;

  notes: LearningNote[];
  createdBy: 'llm' | 'user';
  createdAt: string;
  updatedAt: string;
};
```

### 3.4 TestGoal

각 지식 노드의 baseline 학습 목표다.  
실제 시험 인스턴스는 여러 번 생성될 수 있지만, 노드가 완료되기 위해 만족해야 하는 목표는 TestGoal로 관리한다.

```ts
type TestGoal = {
  id: string;
  nodeId: string;
  graphVersionCreated: number;

  topic: string;
  targetDescription: string;

  difficultyPolicy: {
    initial: '초급';
    onPass: 'next_difficulty';
    onFail: 'same_difficulty';
    maxDifficultyForCompletion: '초급' | '중급' | '고급';
  };

  questionPlan: {
    type1: number;
    type2: number;
    type3: number;
    type4: number;
    type5: number;
  };

  completionRule: {
    requiredOverallVerdict: 'pass';
    requiredDifficulty: '초급' | '중급' | '고급';
  };

  status: 'ready' | 'stale' | 'retired';
};
```

### 3.5 ExamDocument / AnswerKey / TestRecord

`knowledge-understanding-test` v3의 5유형 구조를 따른다.

```ts
type ExamDocument = {
  id: string;
  testGoalId: string;
  nodeId: string;
  topic: string;
  difficulty: '초급' | '중급' | '고급';
  questions: Question[];
};

type AnswerKey = {
  examId: string;
  answers: Record<QuestionId, ModelAnswer>;
  visibility: 'hidden_until_submitted';
};

type TestRecord = {
  id: string;
  examId: string;
  testGoalId: string;
  nodeId: string;
  difficulty: '초급' | '중급' | '고급';

  submittedAnswers: Record<QuestionId, string>;
  results: QuestionResult[];

  summary: {
    overallVerdict: 'pass' | 'fail';
    passCount: number;
    totalCount: number;
    misconceptions: string[];
    nextDifficulty: '초급' | '중급' | '고급' | 'completed';
  };

  createdAt: string;
};
```

---

## 4. 아키텍처 설계

### 4.1 추천 구조

```text
React UI
  ├─ pages/
  │   ├─ HomePage
  │   ├─ IntakePage
  │   ├─ CapstoneReviewPage
  │   ├─ DagWorkspacePage
  │   ├─ NodeStudyPage
  │   ├─ TestRunnerPage
  │   ├─ CapstoneAttemptPage
  │   └─ AchievementLogPage
  │
  ├─ domain/
  │   ├─ projectReducer.ts
  │   ├─ graph.ts
  │   ├─ graphPatch.ts
  │   ├─ testPolicy.ts
  │   └─ achievementLog.ts
  │
  ├─ services/
  │   ├─ llmGateway.ts
  │   ├─ storageRepository.ts
  │   └─ exportService.ts
  │
  ├─ prompts/
  │   ├─ capstonePrompt.ts
  │   ├─ dagPrompt.ts
  │   ├─ graphPatchPrompt.ts
  │   ├─ testPrompt.ts
  │   └─ achievementLogPrompt.ts
  │
  └─ schemas/
      ├─ project.schema.ts
      ├─ graphPatch.schema.ts
      ├─ exam.schema.ts
      └─ result.schema.ts
```

### 4.2 레이어 역할

| 레이어 | 책임 | 하면 안 되는 일 |
|---|---|---|
| UI | 사용자 입력, 시각화, 버튼 액션 | DAG 불변조건 직접 처리 |
| domain | 상태 전이, DAG 검증, reducer | LLM 호출 |
| services | LLM 호출, 저장소, export | 비즈니스 규칙 판단 |
| prompts | 시스템 프롬프트와 JSON 출력 계약 | 앱 상태 직접 변경 |
| schemas | 런타임 검증 | 서비스 로직 포함 |

### 4.3 핵심 패턴

앱 전체는 다음 하나의 패턴으로 통일한다.

```text
Command → LLM Proposal → Schema Validation → Domain Validation → Reducer → Persist
```

예시:

```text
“이 노드를 더 쪼개줘”
    ↓
expand_node command
    ↓
LLM: GraphPatch 제안
    ↓
Zod schema 검증
    ↓
DAG cycle 검증
    ↓
projectReducer 적용
    ↓
window.storage 저장
```

이 패턴만 지키면 노드 분해, 병합, 리팩토링, 캡스톤 추가, 테스트 재생성까지 같은 방식으로 처리할 수 있다.

---

## 5. DAG 설계

### 5.1 그래프 표현

DAG는 중첩 트리가 아니라 정규화된 그래프로 저장한다.

```ts
type Edge = {
  from: NodeId; // prerequisite
  to: NodeId;   // dependent knowledge node or capstone
};
```

`KnowledgeNode.prerequisiteNodeIds`는 렌더링과 프롬프트 편의를 위한 denormalized 필드다.  
저장 전에는 항상 `edges`와 동기화한다.

### 5.2 그래프 불변조건

모든 GraphPatch 적용 후 다음을 검증한다.

1. 모든 edge의 `from`, `to`는 존재하는 노드여야 한다.
2. 자기 자신을 선수로 가질 수 없다.
3. 순환이 없어야 한다.
4. excluded 노드는 active edge의 출발점이나 도착점이 될 수 없다.
5. capstone은 후속 노드를 갖지 않는 리프 노드여야 한다.
6. active capstone으로 가는 경로가 최소 1개 이상 존재해야 한다.
7. 완료된 노드의 prerequisite을 바꾸면 해당 노드와 후속 노드의 testGoal을 `stale`로 표시한다.

### 5.3 필요한 알고리즘

복잡한 알고리즘은 필요 없다. 아래 4개면 충분하다.

```ts
topologicalSort(graph): NodeId[]
detectCycle(graph): boolean
getReadyNodes(graph, completedNodeIds): NodeId[]
getAffectedDescendants(graph, changedNodeIds): NodeId[]
```

- `topologicalSort`: 학습 순서 추천
- `detectCycle`: DAG 안정성 보장
- `getReadyNodes`: 지금 학습 가능한 노드 표시
- `getAffectedDescendants`: 노드 수정 시 stale 처리 범위 계산

---

## 6. GraphPatch

LLM이 반환하는 모든 DAG 변경은 GraphPatch로 통일한다.

```ts
type GraphPatch = {
  id: string;
  reason: string;

  operations: GraphOperation[];

  expectedBaseVersion: number;
};

type GraphOperation =
  | AddNodeOperation
  | UpdateNodeOperation
  | RemoveNodeOperation
  | ExcludeNodeOperation
  | AddEdgeOperation
  | RemoveEdgeOperation
  | ReplaceSubgraphOperation
  | MergeNodesOperation
  | SplitNodeOperation
  | UpdateCapstoneOperation;
```

### 6.1 대표 operation

```ts
type SplitNodeOperation = {
  type: 'split_node';
  targetNodeId: string;
  replacementNodes: KnowledgeNodeDraft[];
  replacementEdges: EdgeDraft[];
  mappingNote: string;
};

type MergeNodesOperation = {
  type: 'merge_nodes';
  sourceNodeIds: string[];
  newNode: KnowledgeNodeDraft;
  edgeRewritePolicy: 'preserve_external_dependencies';
};

type ReplaceSubgraphOperation = {
  type: 'replace_subgraph';
  targetNodeIds: string[];
  newNodes: KnowledgeNodeDraft[];
  newEdges: EdgeDraft[];
  reason: string;
};
```

### 6.2 Patch 적용 규칙

1. Patch는 현재 `graphVersion`과 `expectedBaseVersion`이 같을 때만 적용한다.
2. 적용 전 schema validation을 통과해야 한다.
3. 적용 후 graph invariant validation을 통과해야 한다.
4. 실패하면 patch를 폐기하고 LLM에게 오류와 함께 재시도를 요청한다.
5. 성공하면 `graphVersion += 1` 하고 event log에 저장한다.

---

## 7. 주요 화면 설계

### 7.1 HomePage

- 새 학습 프로젝트 시작
- 기존 프로젝트 목록
- 프로젝트 상태 표시:
  - 캡스톤 검토 중
  - DAG 검토 중
  - 학습 중
  - 캡스톤 도전 가능
  - 완료

### 7.2 IntakePage

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

### 7.3 CapstoneReviewPage

LLM이 제안한 캡스톤을 보여준다.

각 카드:

- 캡스톤명
- 수행 내용
- 성공 기준
- 이 캡스톤이 해당 분야의 무엇을 대표하는지
- 예상 산출물
- 선택 / 수정 / 다시 제안

캡스톤이 확정되면 DAG 초안 생성을 시작한다.

### 7.4 DagWorkspacePage

앱의 중심 화면이다.

#### 좌측: DAG 시각화

- 노드와 선수관계 표시
- 상태별 구분:
  - waiting
  - studying
  - completed
  - excluded
  - stale
- capstone 노드는 별도 강조
- 현재 학습 가능한 ready node 표시

#### 중앙: 선택 노드 상세

- 이름
- 개요
- 선수 노드
- 후속 노드
- 상태
- 현재 TestGoal
- 최근 TestRecord 요약
- 학습 메모

#### 우측: LLM 상호작용 / Patch Preview

자연어 명령 예시:

- “이 노드를 더 세분화해줘”
- “A와 B를 합쳐줘”
- “이 선수관계가 이상한데 다시 검토해줘”
- “내가 C는 이미 아니까 제외해줘”
- “전체 DAG를 더 단순하게 리팩토링해줘”

LLM 응답은 바로 적용하지 않고, Patch Preview로 보여준다.

- 변경 전/후 노드
- 추가/삭제 edge
- stale 처리될 테스트
- 적용 / 폐기 / 다시 요청

### 7.5 NodeStudyPage

하나의 지식 노드를 공부하는 화면.

구성:

- 노드 개요
- 이 노드의 학습 목표: TestGoal
- 학습 메모
- LLM 질의응답
- “테스트 시작”
- “노드 분해 요청”
- “이미 알고 있으므로 제외”
- “학습 중 발견한 선수 지식 추가”

노드 완료 조건:

```text
해당 노드의 TestGoal에서 요구한 난이도의 지식 이해 테스트를 통과한다.
```

### 7.6 TestRunnerPage

`knowledge-understanding-test` v3의 5유형을 지원한다.

중요 규칙:

- 유형 4는 항상 첫 번째로 출제한다.
- 한 문제를 제출하면 수정할 수 없다.
- 답안지는 학습자 제출 전 비공개다.
- 모든 문제는 풀이 과정을 요구한다.
- 채점은 정답 여부뿐 아니라 오개념 위치를 기록한다.

### 7.7 CapstoneAttemptPage

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

캡스톤 판정은 이진 기준으로 한다.  
품질, 만족도, 아쉬움은 회고 필드에 남긴다.

### 7.8 AchievementLogPage

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

---

## 8. LLM 호출 지점

### 8.1 Capstone 생성 / 정제

트리거:

- 학습자가 학습 내용을 입력함
- 학습자가 캡스톤을 입력했지만 성공 기준이 불명확함

입력:

```json
{
  "mode": "learning_content | capstone",
  "userInput": "...",
  "preferences": {
    "outputType": "problem_solution | project | implementation | proof | analysis | auto",
    "difficulty": "intro | normal | challenging | auto",
    "knownKnowledge": [],
    "excludedScope": []
  }
}
```

출력:

```json
{
  "capstoneCandidates": [
    {
      "title": "...",
      "description": "...",
      "successCriteria": "...",
      "outputType": "project",
      "whyCanonical": "..."
    }
  ]
}
```

### 8.2 DAG 초안 생성

트리거:

- capstone 확정

입력:

```json
{
  "capstone": {
    "title": "...",
    "description": "...",
    "successCriteria": "..."
  },
  "knownKnowledge": [],
  "excludedScope": []
}
```

출력:

```json
{
  "nodes": [
    {
      "tempId": "n1",
      "name": "...",
      "summary": "...",
      "prerequisiteTempIds": []
    }
  ],
  "capstonePrerequisiteTempIds": ["n5", "n6"],
  "notes": {
    "uncertainAreas": [],
    "searchPerformed": false,
    "searchQueries": []
  }
}
```

### 8.3 노드별 TestGoal 생성

트리거:

- DAG 초안 승인
- 새 노드 추가
- 노드 내용 또는 선수관계 수정으로 기존 TestGoal이 stale 됨

입력:

```json
{
  "node": {
    "name": "...",
    "summary": "...",
    "prerequisites": []
  },
  "capstoneContext": "...",
  "difficultyPolicy": "baseline"
}
```

출력:

```json
{
  "testGoal": {
    "topic": "...",
    "targetDescription": "...",
    "questionPlan": {
      "type1": 1,
      "type2": 1,
      "type3": 1,
      "type4": 1,
      "type5": 1
    },
    "completionRule": {
      "requiredOverallVerdict": "pass",
      "requiredDifficulty": "초급"
    }
  }
}
```

### 8.4 시험지 생성

트리거:

- 학습자가 노드 테스트 시작

입력:

```json
{
  "testGoal": "...",
  "node": "...",
  "difficulty": "초급",
  "pastTestRecordsSummary": []
}
```

출력:

```json
{
  "exam": {
    "id": "...",
    "nodeId": "...",
    "topic": "...",
    "difficulty": "초급",
    "questions": []
  },
  "answerKey": {
    "examId": "...",
    "answers": {}
  }
}
```

### 8.5 채점

트리거:

- 마지막 문제 제출

입력:

```json
{
  "exam": {},
  "answerKey": {},
  "submittedAnswers": {}
}
```

출력:

```json
{
  "results": [],
  "summary": {
    "overallVerdict": "pass",
    "passCount": 5,
    "totalCount": 5,
    "misconceptions": [],
    "nextDifficulty": "중급"
  }
}
```

### 8.6 DAG 수정 / 리팩토링

트리거:

- 학습자 자연어 편집 지시
- 노드 분해/병합/제외
- 전체 리팩토링 요청
- 새 캡스톤 추가

입력:

```json
{
  "project": "...current compact project snapshot...",
  "userInstruction": "...",
  "expectedBaseVersion": 7
}
```

출력:

```json
{
  "patch": {
    "id": "...",
    "reason": "...",
    "expectedBaseVersion": 7,
    "operations": []
  }
}
```

### 8.7 학습 성취 로그 생성

트리거:

- capstone achieved

입력:

```json
{
  "project": {},
  "finalDag": {},
  "testRecords": [],
  "capstoneAttemptLogs": [],
  "events": []
}
```

출력:

```json
{
  "achievementLog": {
    "title": "...",
    "summary": "...",
    "capstone": {},
    "completedNodes": [],
    "misconceptionTimeline": [],
    "dagEvolution": [],
    "finalReflection": "...",
    "nextSuggestedCapstones": []
  }
}
```

---

## 9. 테스트 정책

### 9.1 기본 난이도 정책

```text
해당 노드의 테스트 기록 없음
  → 초급으로 시작

최근 기록 통과
  → 다음 난이도 추천

최근 기록 미통과
  → 동일 난이도 재시험

TestGoal의 requiredDifficulty 통과
  → 노드 완료 가능
```

### 9.2 노드 완료 정책

기본값은 가볍게 둔다.

```text
requiredDifficulty = 초급
requiredOverallVerdict = pass
```

고급 사용자는 노드별로 완료 기준을 올릴 수 있다.

```text
예: “이 노드는 중급까지 통과해야 완료로 인정”
```

### 9.3 유형 선택 정책

기본 questionPlan:

```json
{
  "type1": 1,
  "type2": 1,
  "type3": 1,
  "type4": 1,
  "type5": 1
}
```

단, 노드 성격에 따라 LLM이 0개 유형을 제안할 수 있다.

예:

- 정의적 개념: 유형 1, 2, 3, 4 중심
- 절차적 개념: 유형 5 중심
- 프로그래밍 구현: 유형 4 + 유형 5 중심
- 수학 정리: 유형 3 + 유형 5 중심

---

## 10. 상태 전이

### 10.1 Project 상태

```text
intake
  → capstone_review
  → dag_review
  → learning
  → capstone_ready
  → completed
```

예외:

- 사용자가 프로젝트를 중단하면 `archived`
- 캡스톤 실패 후 다시 학습하면 `learning`

### 10.2 KnowledgeNode 상태

```text
waiting
  → studying
  → completed

waiting
  → excluded

studying
  → excluded
```

상태 규칙:

- prerequisite이 완료되지 않은 노드는 `studying`으로 바꿀 수 없다.
- `completed` 노드의 prerequisite이 변경되면 완료 상태를 유지할지 재검토한다.
  - 기본 정책: 완료는 유지하되 testGoal을 stale로 표시하고 사용자에게 재검증을 권장한다.
- `excluded` 노드는 active DAG에서 제외되지만 event log에는 남긴다.

### 10.3 Capstone 상태

```text
waiting
  → ready
  → attempting
  → achieved

attempting
  → failed
failed
  → learning
```

---

## 11. 저장소 설계

`window.storage` API를 사용한다. 모든 데이터는 개인 저장소로 저장한다.

| 키 패턴 | 내용 |
|---|---|
| `projects:list` | 프로젝트 ID 목록 |
| `projects:{projectId}` | StudyProject 전체 |
| `projects:{projectId}:events` | ProjectEvent 목록 |
| `tests:{testRecordId}` | TestRecord 상세 |
| `exams:{examId}` | ExamDocument |
| `answerKeys:{examId}` | AnswerKey |
| `achievementLogs:{projectId}` | 최종 성취 로그 |

### 저장 전략

- 프로젝트 본문은 항상 최신 snapshot을 저장한다.
- 주요 변경은 event log에도 저장한다.
- 시험지와 답안지는 프로젝트와 분리 저장한다.
- export는 snapshot + event log + test records를 조합해 생성한다.

---

## 12. React 상태 구조

```ts
type AppState = {
  view:
    | 'home'
    | 'intake'
    | 'capstone-review'
    | 'dag-workspace'
    | 'node-study'
    | 'test-running'
    | 'test-result'
    | 'capstone-attempt'
    | 'achievement-log';

  currentProjectId?: string;
  project?: StudyProject;

  selectedNodeId?: string;
  selectedCapstoneId?: string;

  llm: {
    isLoading: boolean;
    operation:
      | 'capstone'
      | 'dag_draft'
      | 'test_goal'
      | 'exam'
      | 'grading'
      | 'graph_patch'
      | 'achievement_log'
      | null;
    error?: string;
  };

  patchPreview?: GraphPatch;

  testSession?: {
    exam: ExamDocument;
    answerKey: AnswerKey;
    currentQuestionIndex: number;
    answers: Record<QuestionId, string>;
    submittedQuestionIds: string[];
    result?: TestRecord;
  };
};
```

### reducer action 예시

```ts
type ProjectAction =
  | { type: 'CREATE_PROJECT'; payload: StudyProject }
  | { type: 'SET_CAPSTONE_CANDIDATES'; payload: CapstoneCandidate[] }
  | { type: 'CONFIRM_CAPSTONE'; payload: CapstoneNode }
  | { type: 'APPLY_GRAPH_PATCH'; payload: GraphPatch }
  | { type: 'SET_TEST_GOAL'; payload: TestGoal }
  | { type: 'START_NODE'; payload: { nodeId: string } }
  | { type: 'COMPLETE_NODE'; payload: { nodeId: string; testRecordId: string } }
  | { type: 'SAVE_TEST_RECORD'; payload: TestRecord }
  | { type: 'START_CAPSTONE_ATTEMPT'; payload: { capstoneId: string } }
  | { type: 'COMPLETE_CAPSTONE'; payload: CapstoneAttemptLog }
  | { type: 'SAVE_ACHIEVEMENT_LOG'; payload: AchievementLog };
```

---

## 13. UI 세부 정책

### 13.1 DAG 시각화

초기 구현에서는 복잡한 그래프 레이아웃보다 **계층형 카드 리스트 + 간단한 edge 표시**를 우선한다.

추천:

- 위쪽: ready node
- 가운데: waiting node
- 아래쪽: capstone
- 각 노드 카드에 prerequisite chips 표시
- 전체 그래프는 필요하면 SVG 미니맵으로 보조 표시

이유:

- DAG 레이아웃은 구현 난이도가 높다.
- 학습자에게 당장 중요한 것은 “지금 무엇을 공부할 수 있는가”다.
- 안정적인 제품은 예쁜 그래프보다 명확한 상태 전이가 먼저다.

### 13.2 Patch Preview

LLM이 DAG 변경안을 제안하면 다음을 보여준다.

```text
변경 요약
- 추가 노드 3개
- 삭제/제외 노드 1개
- 변경 edge 4개
- stale 처리될 테스트 2개

[적용] [폐기] [다시 요청]
```

### 13.3 노드 카드 필드

- 이름
- 2~4문장 개요
- 선수 노드
- 테스트 상태
- 학습 상태
- 최근 오개념
- 액션:
  - 공부 시작
  - 테스트 보기
  - 더 쪼개기
  - 병합/수정
  - 제외

---

## 14. 프롬프트 운영 원칙

### 14.1 LLM 출력은 JSON만

모든 앱 내부 API 호출은 JSON만 받는다.

시스템 프롬프트 공통 규칙:

```text
JSON만 출력한다.
마크다운 코드 블록을 사용하지 않는다.
설명 문장을 JSON 밖에 쓰지 않는다.
```

### 14.2 LLM에게 맡길 것

- 캡스톤 후보 생성
- 이진 성공 기준 정제
- 역추적 DAG 초안 생성
- 노드 분해/병합/리팩토링 제안
- 지식 이해 테스트 생성
- 서술형 답안 채점
- 학습 성취 로그 서술

### 14.3 앱이 직접 처리할 것

- DAG 순환 검증
- node/edge ID 관리
- 상태 전이 검증
- 학습 가능한 ready node 계산
- testGoal stale 처리
- 저장/불러오기
- 답안 제출 잠금
- graphVersion 관리
- event log 기록

---

## 15. 성취 로그 스키마

```ts
type AchievementLog = {
  id: string;
  projectId: string;
  title: string;

  originalInput: string;

  capstone: {
    title: string;
    description: string;
    successCriteria: string;
    result: 'achieved' | 'failed';
    submittedOutputSummary: string;
  };

  finalDag: {
    nodes: KnowledgeNode[];
    edges: Edge[];
  };

  completedKnowledge: {
    nodeId: string;
    name: string;
    testRecords: {
      difficulty: string;
      verdict: string;
      misconceptions: string[];
    }[];
  }[];

  dagEvolution: {
    version: number;
    eventType: string;
    summary: string;
    createdAt: string;
  }[];

  misconceptionTimeline: {
    misconception: string;
    firstDetectedAt: string;
    resolvedAt?: string;
    relatedNodeIds: string[];
  }[];

  reflection: {
    strongestGains: string[];
    remainingWeaknesses: string[];
    nextCapstoneSuggestions: string[];
  };

  createdAt: string;
};
```

### 텍스트 출력 형식

```text
# 학습 성취 로그

## 1. 학습 목표
- 원래 입력:
- 확정 캡스톤:
- 성공 기준:

## 2. 최종 지식 DAG
...

## 3. 완료한 지식 노드
...

## 4. 지식 이해 테스트 결과
...

## 5. DAG 변화 기록
...

## 6. 발견된 오개념과 해소 과정
...

## 7. 캡스톤 결과
...

## 8. 다음 탐험 후보
...
```

---

## 16. 구현 우선순위

### 1차 구현: 안정적인 MVP

필수:

1. 학습 내용/캡스톤 입력
2. 캡스톤 후보 생성 또는 성공 기준 정제
3. DAG 초안 생성
4. DAG 카드 리스트 표시
5. GraphPatch 기반 노드 수정
6. 노드별 TestGoal 생성
7. 시험 생성·진행·채점
8. 노드 완료 처리
9. 캡스톤 완료 처리
10. 학습 성취 로그 출력
11. window.storage 저장/불러오기

보류:

- 고급 그래프 시각화
- 다중 캡스톤 통합
- 외부 자료 업로드 기반 학습
- 협업 기능
- 추천 자료 검색

### 2차 구현: 그래프 성장

1. 다중 캡스톤 추가
2. 기존 DAG와 새 DAG 통합 리팩토링
3. 중복 노드 감지
4. 장기 개인 지식 그래프
5. 더 정교한 성취 로그

### 3차 구현: 학습 경험 강화

1. 학습 메모와 테스트 오개념 연결
2. 노드별 자료 추천
3. 캡스톤 산출물 자동 검증 보조
4. 그래프 미니맵
5. 학습 회고 타임라인

---

## 17. 미결 결정 사항

| 항목 | 기본 제안 | 이유 |
|---|---|---|
| 전체 시험 생성 시점 | 노드 학습 시작 시 생성 | DAG 수정 시 stale 문제가 적고 비용이 낮다 |
| TestGoal 생성 시점 | DAG 승인 직후 모든 active 노드에 생성 | 각 노드의 학습 목표를 초기에 명확히 한다 |
| 노드 완료 기준 | 초급 pass | baseline 우선 원칙과 맞다 |
| DAG 시각화 | 카드 리스트 우선 | 구현 안정성이 높다 |
| 답안지 저장 | exam과 분리 저장 | 제출 전 노출 방지 |
| LLM 변경 적용 | patch preview 후 사용자 승인 | 학습자 주도와 안정성 확보 |
| 다중 캡스톤 | 2차 구현 | MVP 복잡도 절감 |

---

## 18. 참조 문서

- `learning-scope-decomposition-skill-v2.md`
- `knowledge-understanding-test-skill-v3.md`

앱 구현 시 위 두 문서의 시스템 프롬프트를 그대로 붙여 넣기보다, 본 기획 문서의 JSON 스키마와 GraphPatch 계약에 맞춰 **앱용 시스템 프롬프트**로 압축해 사용한다.
