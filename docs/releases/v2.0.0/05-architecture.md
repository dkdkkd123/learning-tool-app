# Technical Architecture

Status: Draft
Version: v2.0.0
Last Updated: 2026-06-22
Owns: 구현 구조, reducer, validation, storage, event log, graph layout state
Depends On:
  - `02-domain-model.md`
  - `03-llm-orchestration.md`
  - `04-ux-spec.md`

---

## Architecture Principle

복잡한 자동 계획 알고리즘보다 작은 patch와 강한 불변조건을 우선한다.

```text
Command → LLM Proposal → Schema Validation → Domain Validation → Reducer → Persist
```

---

## Recommended Source Structure

```text
src/
  pages/
    HomePage.tsx
    IntakePage.tsx
    CapstoneReviewPage.tsx
    DagWorkspacePage.tsx
    NodeStudyPage.tsx
    TestRunnerPage.tsx
    CapstoneAttemptPage.tsx
    AchievementLogPage.tsx

  components/
    inspector/
      NodeInspector.tsx
      CapstoneInspector.tsx
    patch/
      PatchPreview.tsx

  domain/
    projectReducer.ts
    graph.ts
    graphPatch.ts
    graphValidation.ts
    testPolicy.ts
    achievementLog.ts

  services/
    llmGateway.ts
    storageRepository.ts
    exportService.ts

  prompts/
    capstonePrompt.ts
    dagPrompt.ts
    graphPatchPrompt.ts
    testPrompt.ts
    achievementLogPrompt.ts

  schemas/
    project.schema.ts
    graphPatch.schema.ts
    exam.schema.ts
    result.schema.ts
```

---

## Layer Responsibilities

| 레이어 | 책임 | 하면 안 되는 일 |
|---|---|---|
| UI | 사용자 입력, 시각화, 버튼 액션 | DAG 불변조건 직접 처리 |
| domain | 상태 전이, DAG 검증, reducer | LLM 호출 |
| services | LLM 호출, 저장소, export | 비즈니스 규칙 판단 |
| prompts | 시스템 프롬프트와 JSON 출력 계약 | 앱 상태 직접 변경 |
| schemas | 런타임 검증 | 서비스 로직 포함 |

---

## Graph Algorithms

필요한 알고리즘은 4개면 충분하다.

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

## GraphPatch Apply Pipeline

```text
사용자 명령 또는 버튼 액션
    ↓
Command 생성
    ↓
LLM GraphPatch 후보 생성
    ↓
Zod schema validation
    ↓
Domain validation
    - node id 유효성
    - edge 유효성
    - cycle 없음
    - capstone leaf 유지
    - excluded node edge 없음
    - expectedBaseVersion 일치
    ↓
Patch Preview 표시
    ↓
사용자 승인
    ↓
projectReducer 적용
    ↓
graphVersion += 1
    ↓
event log 저장
    ↓
window.storage persist
```

---

## React App State

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

---

## Reducer Actions

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

## Storage Design

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

저장 전략:

- 프로젝트 본문은 항상 최신 snapshot을 저장한다.
- 주요 변경은 event log에도 저장한다.
- 시험지와 답안지는 프로젝트와 분리 저장한다.
- export는 snapshot + event log + test records를 조합해 생성한다.

---

## Error Handling

| 오류 | 처리 |
|---|---|
| LLM JSON parse 실패 | 같은 입력으로 JSON-only 재시도 |
| schema validation 실패 | 오류 위치를 LLM에 전달해 재생성 요청 |
| cycle 발생 | patch 폐기, cycle 경로 표시 |
| expectedBaseVersion 불일치 | patch 폐기, 최신 graph 기준으로 다시 요청 |
| answerKey 노출 위험 | test runner 진입 전 visibility 확인 |

---

## Export Strategy

최종 성취 로그는 다음을 조합해 만든다.

- StudyProject snapshot
- final DAG
- ProjectEvent log
- TestRecord 목록
- CapstoneAttemptLog
- AchievementLog LLM output

초기 export 형식은 Markdown으로 충분하다. 이후 JSON, PDF, 공유 링크를 추가할 수 있다.
