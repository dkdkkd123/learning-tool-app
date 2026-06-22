import type { KnowledgeNode, CapstoneNode, TestGoal, ExamDocument, AnswerKey } from '../domain/types';

export const TEST_GOAL_SYSTEM_PROMPT = `당신은 학습 평가 설계 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

지식 노드에 대한 TestGoal을 생성합니다. TestGoal은 해당 노드의 이해도를 평가하기 위한 계획입니다.

5가지 문제 유형:
- type1: 개념 이해 확인 (정의, 설명)
- type2: 적용 문제 (주어진 상황에 개념 적용)
- type3: 분석/비교 (개념 간 차이점, 장단점)
- type4: 역추론 (개념을 직접 언급하지 않고 증상/결과로 개념을 유추)
- type5: 종합 응용 (여러 개념을 결합한 복합 문제)

questionPlan에서 각 type의 개수를 결정합니다 (0~2개, 총 3~6개).
type4는 반드시 1개 이상 포함해야 합니다.

응답 형식:
{
  "topic": "평가 주제",
  "targetDescription": "이 노드를 통해 학습자가 달성해야 할 목표",
  "questionPlan": {
    "type1": 1,
    "type2": 1,
    "type3": 0,
    "type4": 1,
    "type5": 1
  },
  "completionRule": {
    "requiredOverallVerdict": "pass",
    "requiredDifficulty": "중급"
  }
}`;

export function buildTestGoalUserPrompt(node: KnowledgeNode, capstone: CapstoneNode): string {
  return `지식 노드 정보:
이름: ${node.name}
설명: ${node.summary}

관련 캡스톤:
제목: ${capstone.title}
설명: ${capstone.description}

이 노드의 이해도를 평가하기 위한 TestGoal을 생성해주세요.`;
}

export const EXAM_SYSTEM_PROMPT = `당신은 학습 평가 문제 출제 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

주어진 TestGoal을 바탕으로 실제 시험 문제와 모범 답안을 생성합니다.

난이도 기준:
- 초급: 기본 개념 이해, 단순 정의 및 기본 적용
- 중급: 개념 간 관계 이해, 적절한 문맥에서의 적용
- 고급: 복합적 상황 분석, 심화 응용, 예외 상황 처리

type4 문제 주의: 주제를 직접 언급하지 않고, 증상이나 결과만 제시하여 학습자가 개념을 유추하도록 합니다.

응답 형식:
{
  "exam": {
    "id": "exam_{id}",
    "testGoalId": "{testGoalId}",
    "nodeId": "{nodeId}",
    "topic": "{topic}",
    "difficulty": "초급|중급|고급",
    "questions": [
      {
        "id": "q_1",
        "type": 4,
        "content": "문제 내용"
      }
    ]
  },
  "answerKey": {
    "examId": "exam_{id}",
    "answers": {
      "q_1": {
        "questionId": "q_1",
        "answer": "모범 답안",
        "explanation": "채점 기준 및 설명"
      }
    },
    "visibility": "hidden_until_submitted"
  }
}`;

export function buildExamUserPrompt(
  testGoal: TestGoal,
  node: KnowledgeNode,
  difficulty: '초급' | '중급' | '고급',
  pastRecordsSummary?: string
): string {
  const lines: string[] = [];
  lines.push(`노드: ${node.name}`);
  lines.push(`노드 설명: ${node.summary}`);
  lines.push(`평가 주제: ${testGoal.topic}`);
  lines.push(`목표: ${testGoal.targetDescription}`);
  lines.push(`난이도: ${difficulty}`);
  lines.push(`문제 계획: type1=${testGoal.questionPlan.type1}, type2=${testGoal.questionPlan.type2}, type3=${testGoal.questionPlan.type3}, type4=${testGoal.questionPlan.type4}, type5=${testGoal.questionPlan.type5}`);
  lines.push(`TestGoal ID: ${testGoal.id}`);
  lines.push(`Node ID: ${testGoal.nodeId}`);

  if (pastRecordsSummary) {
    lines.push(`\n이전 시험 기록 요약 (참고용): ${pastRecordsSummary}`);
  }

  lines.push('\n위 정보를 바탕으로 시험 문제와 모범 답안을 생성해주세요. type4 문제를 첫 번째로 배치해주세요.');
  return lines.join('\n');
}

export const GRADING_SYSTEM_PROMPT = `당신은 학습 평가 채점 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

학습자의 답변을 모범 답안과 비교하여 채점합니다.

채점 기준:
- pass: 핵심 개념을 올바르게 이해하고 표현한 경우
- fail: 핵심 개념 오해, 누락, 또는 오류가 있는 경우

misconception: 잘못된 이해나 오개념이 있는 경우에만 명시합니다.

응답 형식:
{
  "results": [
    {
      "questionId": "q_1",
      "verdict": "pass|fail",
      "feedback": "구체적인 피드백 (잘한 점, 부족한 점)",
      "misconception": "오개념이 있는 경우만 기재 (없으면 null)"
    }
  ],
  "summary": {
    "overallVerdict": "pass|fail",
    "passCount": 3,
    "totalCount": 4,
    "misconceptions": ["오개념1", "오개념2"],
    "nextDifficulty": "초급|중급|고급|completed"
  }
}`;

export function buildGradingUserPrompt(
  exam: ExamDocument,
  answerKey: AnswerKey,
  submittedAnswers: Record<string, string>,
  completionRule: TestGoal['completionRule']
): string {
  const lines: string[] = [];
  lines.push(`주제: ${exam.topic}`);
  lines.push(`난이도: ${exam.difficulty}`);
  lines.push(`완료 조건: ${completionRule.requiredDifficulty} 난이도에서 pass`);
  lines.push('\n문제별 채점:');

  for (const question of exam.questions) {
    const modelAnswer = answerKey.answers[question.id];
    const submitted = submittedAnswers[question.id] ?? '(미응답)';
    lines.push(`\n[문제 ${question.id} - type${question.type}]`);
    lines.push(`문제: ${question.content}`);
    lines.push(`학습자 답변: ${submitted}`);
    lines.push(`모범 답안: ${modelAnswer?.answer ?? '없음'}`);
    lines.push(`채점 기준: ${modelAnswer?.explanation ?? '없음'}`);
  }

  const currentDiff = exam.difficulty;
  const nextDiffMap: Record<string, string> = {
    '초급': '중급',
    '중급': '고급',
    '고급': 'completed',
  };
  lines.push(`\n현재 난이도: ${currentDiff}`);
  lines.push(`다음 난이도 (pass시): ${nextDiffMap[currentDiff] ?? 'completed'}`);
  lines.push('위 정보를 바탕으로 채점 결과를 JSON으로 반환해주세요.');

  return lines.join('\n');
}
