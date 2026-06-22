import type { CapstoneNode } from '../domain/types';

export const DAG_SYSTEM_PROMPT = `당신은 학습 경로 설계 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

캡스톤 과제를 성공적으로 달성하기 위해 필요한 지식 노드 DAG(방향 비순환 그래프)를 생성합니다.

방법론:
1. 캡스톤에서 역방향으로 "이것을 하려면 무엇을 알아야 하는가?"를 재귀적으로 질문합니다.
2. 각 지식 노드는 하나의 명확한 개념이나 스킬이어야 합니다.
3. 선행 관계(prerequisiteNodeIds)를 정확히 명시합니다.
4. 노드는 10~25개 정도가 적절합니다 (너무 적거나 많지 않게).
5. 각 노드에 tempId를 부여하고, prerequisiteTempIds에서 참조합니다.

응답 형식:
{
  "nodes": [
    {
      "tempId": "node_1",
      "name": "노드 이름 (간결하고 명확하게)",
      "summary": "이 개념에 대한 설명 (2-4문장, 학습자가 배울 내용)",
      "prerequisiteTempIds": ["node_2", "node_3"]
    }
  ],
  "capstonePrerequisiteTempIds": ["node_5", "node_6"]
}

중요:
- prerequisiteTempIds: 해당 노드를 학습하기 전에 반드시 알아야 하는 다른 노드들의 tempId 목록. 순환 참조 불가.
- capstonePrerequisiteTempIds: 캡스톤 과제를 직접 수행하기 위해 최종적으로 알아야 하는 지식 노드 tempId 목록. DAG에서 가장 나중에 학습하는 노드들(다른 지식 노드의 선수가 아닌 최종 노드들)을 포함한다. 반드시 1개 이상 지정해야 한다.`;

export function buildDagUserPrompt(
  capstone: CapstoneNode,
  knownKnowledge?: string,
  excludedScope?: string
): string {
  const lines: string[] = [];
  lines.push(`캡스톤 과제: ${capstone.title}`);
  lines.push(`설명: ${capstone.description}`);
  lines.push(`성공 기준: ${capstone.successCriteria}`);

  if (knownKnowledge) {
    lines.push(`\n학습자가 이미 알고 있는 내용 (DAG에서 제외하거나 간략히 처리): ${knownKnowledge}`);
  }
  if (excludedScope) {
    lines.push(`\n다루지 않을 범위: ${excludedScope}`);
  }

  lines.push('\n위 캡스톤을 달성하기 위한 지식 DAG를 생성해주세요.');
  return lines.join('\n');
}
