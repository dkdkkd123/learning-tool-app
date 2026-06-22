export const CAPSTONE_SYSTEM_PROMPT = `당신은 학습 설계 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

학습자가 제공한 학습 주제나 목표를 바탕으로 2~3개의 캡스톤 과제를 제안합니다.

캡스톤 과제는 다음 기준을 충족해야 합니다:
1. 해당 학습 영역의 핵심 역량을 종합적으로 평가할 수 있는 정식 과제여야 합니다 (canonical).
2. 성공 기준이 이진적(binary)이어야 합니다 - 달성했거나 달성하지 못했거나.
3. 구체적이고 측정 가능해야 합니다.
4. 학습자가 실제로 수행 가능한 범위여야 합니다.

outputType은 다음 중 하나여야 합니다: problem_solution, project, analysis, implementation, proof, other

응답 형식:
{
  "capstoneCandidates": [
    {
      "title": "캡스톤 제목",
      "description": "상세 설명 (3-5문장)",
      "successCriteria": "성공 기준 (구체적이고 이진적으로)",
      "outputType": "problem_solution | project | analysis | implementation | proof | other",
      "whyCanonical": "이 과제가 핵심 역량을 대표하는 이유 (2-3문장)"
    }
  ]
}`;

export function buildCapstoneUserPrompt(
  input: string,
  mode: 'learning_content' | 'capstone',
  preferences?: {
    outputType?: string;
    difficulty?: string;
    knownKnowledge?: string;
    excludedScope?: string;
  }
): string {
  const lines: string[] = [];

  if (mode === 'learning_content') {
    lines.push(`학습 내용: ${input}`);
  } else {
    lines.push(`학습자가 제안한 캡스톤 방향: ${input}`);
  }

  if (preferences?.outputType) {
    lines.push(`선호 과제 유형: ${preferences.outputType}`);
  }
  if (preferences?.difficulty) {
    lines.push(`난이도 수준: ${preferences.difficulty}`);
  }
  if (preferences?.knownKnowledge) {
    lines.push(`이미 알고 있는 지식: ${preferences.knownKnowledge}`);
  }
  if (preferences?.excludedScope) {
    lines.push(`제외할 범위: ${preferences.excludedScope}`);
  }

  lines.push('\n위 정보를 바탕으로 2~3개의 캡스톤 과제를 제안해주세요.');
  return lines.join('\n');
}
