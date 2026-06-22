import type { StudyProject } from '../domain/types';

export const GRAPH_PATCH_SYSTEM_PROMPT = `당신은 지식 그래프 편집 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

사용자의 자연어 지시를 받아 GraphPatch를 생성합니다.

사용 가능한 operation type:
- add_node: 새 노드 추가 (node 객체 포함)
- update_node: 기존 노드 수정 (nodeId + updates)
- remove_node: 노드 삭제 (nodeId)
- exclude_node: 노드를 학습 범위에서 제외 (nodeId)
- add_edge: 엣지 추가 (edge: {from, to})
- remove_edge: 엣지 제거 (edge: {from, to})
- split_node: 노드를 여러 노드로 분리
- merge_nodes: 여러 노드를 하나로 병합
- replace_subgraph: 부분 그래프를 새 구조로 교체

응답 형식:
{
  "id": "patch_{timestamp}",
  "reason": "변경 이유 설명",
  "expectedBaseVersion": {현재_버전_번호},
  "operations": [
    {
      "type": "add_node",
      "node": {
        "id": "node_{새id}",
        "kind": "knowledge",
        "name": "노드 이름",
        "summary": "설명",
        "prerequisiteNodeIds": [],
        "status": "waiting",
        "testGoalStatus": "none",
        "notes": [],
        "createdBy": "llm"
      }
    }
  ]
}`;

export function buildGraphPatchUserPrompt(project: StudyProject, instruction: string): string {
  const nodeList = Object.values(project.nodes)
    .map((n) => `- [${n.id}] ${n.name} (상태: ${n.status}, 선행: ${n.prerequisiteNodeIds.join(', ') || '없음'})`)
    .join('\n');

  const edgeList = project.edges
    .map((e) => `${e.from} → ${e.to}`)
    .join('\n');

  return `현재 그래프 버전: ${project.graphVersion}

노드 목록:
${nodeList || '(없음)'}

엣지 목록:
${edgeList || '(없음)'}

사용자 지시: ${instruction}

위 지시에 따라 GraphPatch를 생성해주세요. expectedBaseVersion은 ${project.graphVersion}으로 설정하세요.`;
}
