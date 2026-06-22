# LLM Orchestration

Status: Draft
Version: v2.0.0
Last Updated: 2026-06-22
Owns: LLM 호출 지점, 입력/출력 JSON 계약, 프롬프트 운영 원칙
Depends On:
  - `02-domain-model.md`

---

## Principle

LLM은 앱의 상태를 직접 바꾸지 않는다. LLM은 항상 구조화된 후보를 반환하고, 앱은 schema validation과 domain validation을 거쳐 reducer로 적용한다.

```text
Command → LLM Proposal → Schema Validation → Domain Validation → Reducer → Persist
```

---

## Common Output Rules

모든 앱 내부 LLM 호출은 JSON만 반환한다.

```text
JSON만 출력한다.
마크다운 코드 블록을 사용하지 않는다.
설명 문장을 JSON 밖에 쓰지 않는다.
```

프롬프트에는 항상 다음 맥락을 포함한다.

- 현재 project summary
- active capstone
- graphVersion
- 관련 노드 또는 테스트 기록
- 사용자 지시
- 반환해야 하는 JSON schema

---

## 1. Capstone Proposal / Refinement

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

규칙:

1. successCriteria는 성공/실패를 이진 판정할 수 있어야 한다.
2. 학습 내용만 주어진 경우 canonical 문제 또는 프로젝트를 2~3개 제안한다.
3. 각 후보에는 그 캡스톤이 분야의 무엇을 대표하는지 설명한다.

---

## 2. DAG Draft Generation

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

규칙:

1. 캡스톤에서 “이것을 달성하려면 무엇을 알아야 하는가?”를 재귀적으로 역추적한다.
2. 모든 노드는 이름과 2~4문장 summary를 가져야 한다.
3. 선수관계는 역추적 과정에서 자연스럽게 결정한다.
4. 불확실한 분야는 웹 탐색을 사용한다.
5. 앱은 tempId를 실제 NodeId로 변환한 뒤 GraphPatch 또는 initial graph로 저장한다.

---

## 3. TestGoal Generation

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

규칙:

1. TestGoal은 노드의 baseline 학습 목표다.
2. 노드 성격에 맞지 않는 유형은 0개로 둘 수 있다.
3. 기본 완료 기준은 초급 pass다.

---

## 4. Exam Generation

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

규칙:

1. 지식 이해 테스트는 5유형을 따른다.
2. 유형 4는 시험 진행 화면에서 항상 첫 번째로 렌더링한다.
3. 답안지는 학습자 제출 전 비공개다.
4. 단순 암기가 아니라 외연 생성, 분류, 논증, 내포 디자인, 내포 적용을 측정한다.

---

## 5. Grading

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

규칙:

1. 결과가 맞아도 근거가 틀렸다면 오개념으로 기록한다.
2. 서술형은 사고 과정에서 드러난 오개념 위치를 특정한다.
3. 종합 피드백에 다음 시험 권장 난이도를 포함한다.

---

## 6. DAG Patch / Refactor

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

규칙:

1. Patch는 현재 `graphVersion`과 `expectedBaseVersion`이 같을 때만 적용 가능하다.
2. LLM은 변경 이유와 영향 범위를 설명해야 한다.
3. 앱은 patch를 적용하기 전에 schema와 DAG invariant를 검증한다.
4. 실패하면 patch를 폐기하고 오류 정보를 포함해 재시도를 요청한다.

---

## 7. Achievement Log Generation

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

규칙:

1. 성취 로그는 학습 여정의 최종 산출물이다.
2. 단순 요약이 아니라 캡스톤, DAG 변화, 테스트 기록, 오개념 변화, 다음 탐험 후보를 포함한다.
3. 품질 평가는 캡스톤 성공 판정과 분리해 회고로 작성한다.
