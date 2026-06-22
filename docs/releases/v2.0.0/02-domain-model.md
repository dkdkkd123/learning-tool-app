# Domain Model

Status: Stable
Version: v2.0.0
Last Updated: 2026-06-22
Owns: 핵심 도메인 객체, DAG 불변조건, GraphPatch 계약의 의미
Depends On: []

---

## Design Principle

도메인 모델은 앱의 헌법이다. UX와 프롬프트는 바뀔 수 있지만, 다음 원칙은 쉽게 흔들지 않는다.

> LLM은 제안하고, 앱의 도메인 로직이 검증하고 적용한다.

---

## StudyProject

앱의 최상위 단위. 하나의 캡스톤 중심 학습 여정을 의미한다.

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

---

## CapstoneNode

캡스톤도 DAG의 노드다. 다만 지식 노드와 완료 기준이 다르다.

```ts
type CapstoneNode = {
  id: string;
  kind: 'capstone';
  title: string;
  description: string;
  successCriteria: string;
  outputType: 'problem_solution' | 'project' | 'analysis' | 'implementation' | 'proof' | 'other';

  prerequisiteNodeIds: NodeId[];
  status: 'waiting' | 'ready' | 'attempting' | 'achieved' | 'failed';

  attemptLogs: CapstoneAttemptLog[];
};
```

규칙:

1. 캡스톤은 이진 성공 기준을 가져야 한다.
2. 캡스톤은 DAG의 리프 노드다.
3. 캡스톤은 active knowledge node만 선수로 가질 수 있다.
4. 캡스톤의 품질 평가는 성공 판정과 분리해 회고로 남긴다.

---

## KnowledgeNode

```ts
type KnowledgeNode = {
  id: string;
  kind: 'knowledge';
  name: string;
  summary: string;
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

규칙:

1. `summary`는 2~4문장으로 작성한다.
2. `completed` 상태가 되려면 연결된 TestGoal의 완료 기준을 만족해야 한다.
3. `excluded` 노드는 active DAG에서 제외되지만 event log에는 남긴다.
4. 선수관계가 바뀌면 해당 노드와 후속 노드의 TestGoal은 `stale`이 될 수 있다.

---

## Edge

DAG는 중첩 트리가 아니라 정규화된 그래프로 저장한다.

```ts
type Edge = {
  from: NodeId;
  to: NodeId;
};
```

`from`은 prerequisite이고, `to`는 그 지식이 필요한 후속 노드 또는 캡스톤이다.

---

## TestGoal

각 지식 노드의 baseline 학습 목표다.

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

기본 완료 기준은 가볍게 둔다.

```text
requiredDifficulty = 초급
requiredOverallVerdict = pass
```

고급 사용자는 노드별로 완료 기준을 올릴 수 있다.

---

## ExamDocument / AnswerKey / TestRecord

지식 이해 테스트는 5유형 구조를 따른다.

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

## GraphPatch

LLM이 반환하는 모든 DAG 변경 제안은 GraphPatch로 통일한다.

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

대표 operation:

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

---

## Graph Invariants

모든 GraphPatch 적용 후 다음을 검증한다.

1. 모든 edge의 `from`, `to`는 존재하는 노드여야 한다.
2. 자기 자신을 선수로 가질 수 없다.
3. 순환이 없어야 한다.
4. excluded 노드는 active edge의 출발점이나 도착점이 될 수 없다.
5. capstone은 후속 노드를 갖지 않는 리프 노드여야 한다.
6. active capstone으로 가는 경로가 최소 1개 이상 존재해야 한다.
7. 완료된 노드의 prerequisite을 바꾸면 해당 노드와 후속 노드의 TestGoal을 `stale`로 표시한다.

---

## State Transitions

### Project

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

### KnowledgeNode

```text
waiting
  → studying
  → completed

waiting
  → excluded

studying
  → excluded
```

규칙:

- prerequisite이 완료되지 않은 노드는 `studying`으로 바꿀 수 없다.
- `completed` 노드의 prerequisite이 변경되면 완료 상태는 유지하되 testGoal을 stale로 표시하고 재검증을 권장한다.

### Capstone

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

## AchievementLog

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
