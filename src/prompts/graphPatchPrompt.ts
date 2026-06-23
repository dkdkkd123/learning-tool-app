import type { StudyProject } from '../domain/types';

export const GRAPH_PATCH_SYSTEM_PROMPT = `당신은 지식 그래프 편집 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

사용자의 자연어 지시를 받아 GraphPatch를 생성합니다.

━━━ 사용 가능한 operation 전체 스키마 ━━━

▸ add_node — 새 노드 추가
{ "type": "add_node", "node": { "id": "node_NEW_ID", "kind": "knowledge", "name": "이름", "summary": "설명", "prerequisiteNodeIds": [], "status": "waiting", "testGoalStatus": "none", "notes": [], "createdBy": "llm" } }

▸ update_node — 기존 노드 수정
{ "type": "update_node", "nodeId": "EXISTING_NODE_ID", "updates": { "name": "새 이름", "summary": "새 설명" } }

▸ remove_node — 노드와 연결 엣지를 완전 삭제
{ "type": "remove_node", "nodeId": "EXISTING_NODE_ID" }

▸ exclude_node — 노드를 삭제하고 선행→후행 엣지를 transitive하게 재연결
{ "type": "exclude_node", "nodeId": "EXISTING_NODE_ID" }

▸ add_edge — 엣지 추가
{ "type": "add_edge", "edge": { "from": "FROM_NODE_ID", "to": "TO_NODE_ID" } }

▸ remove_edge — 엣지 제거
{ "type": "remove_edge", "edge": { "from": "FROM_NODE_ID", "to": "TO_NODE_ID" } }

▸ split_node — 노드를 여러 노드로 분리 (대체 노드와 엣지를 명시)
{ "type": "split_node", "targetNodeId": "EXISTING_NODE_ID", "replacementNodes": [ { "id": "node_A", "kind": "knowledge", "name": "분리된 노드 A", "summary": "", "prerequisiteNodeIds": [], "status": "waiting", "testGoalStatus": "none", "notes": [], "createdBy": "llm" } ], "replacementEdges": [ { "from": "node_A", "to": "node_B" } ], "mappingNote": "분리 이유" }

▸ merge_nodes — 여러 노드를 하나로 병합
{ "type": "merge_nodes", "sourceNodeIds": ["ID_1", "ID_2"], "newNode": { "id": "node_MERGED", "kind": "knowledge", "name": "병합된 노드", "summary": "", "prerequisiteNodeIds": [], "status": "waiting", "testGoalStatus": "none", "notes": [], "createdBy": "llm" } }

▸ replace_subgraph — 여러 노드를 새 구조로 교체
{ "type": "replace_subgraph", "targetNodeIds": ["ID_1", "ID_2"], "newNodes": [ { "id": "node_NEW", "kind": "knowledge", "name": "새 노드", "summary": "", "prerequisiteNodeIds": [], "status": "waiting", "testGoalStatus": "none", "notes": [], "createdBy": "llm" } ], "newEdges": [ { "from": "node_NEW", "to": "EXISTING_ID" } ] }

━━━ 노드 분리/교체 시 필수 엣지 처리 규칙 ━━━

노드를 분리할 때 기존 선행/후행 연결을 반드시 새 노드들에 분배해야 한다.
연결이 끊기면 그래프가 단절되므로 이 규칙은 절대적이다.
원본 노드는 반드시 remove_node로 삭제한다 (exclude_node 금지 — transitive 엣지가 생겨 구조가 망가짐).

━━ 핵심 판단: 세부 노드들끼리 의존 관계가 있는가? ━━

▸ 순차적 (의존 관계 있음): 앞 노드를 학습해야 뒤 노드를 이해할 수 있는 경우
  → 체인 구조: 선행들 → A → B → C → 후행들

  예시) "파이썬 기초"를 변수/함수/클래스로 분리 (클래스는 함수를, 함수는 변수를 알아야 함):
    선행 → [변수와 자료형] → [함수와 제어흐름] → [클래스와 객체] → 후행

  operation 순서:
    1. add_node × N
    2. add_edge: 각 선행 → 첫 번째 세부 노드
    3. add_edge: 세부 노드 간 체인 (A→B, B→C)
    4. add_edge: 마지막 세부 노드 → 각 후행
    5. remove_node: 원본 삭제

▸ 병렬 (독립적): 세부 노드들이 서로 의존하지 않고 독립적으로 학습 가능한 경우
  → 병렬 구조: 모든 세부 노드가 각각 선행들과 후행들에 연결, 세부 노드끼리는 연결하지 않음

  예시) "선형대수학"을 벡터/행렬/고유값으로 분리 (셋은 독립적으로 학습 가능):
    선행 → [벡터 연산] → 후행
    선행 → [행렬 연산] → 후행
    선행 → [고유값 분해] → 후행

  operation 순서:
    1. add_node × N
    2. add_edge: 각 선행 → 각 세부 노드 (모두)
    3. add_edge: 각 세부 노드 → 각 후행 (모두)
    4. remove_node: 원본 삭제

━━ 구체 예시 (순차적) ━━
원본 "파이썬 기초"(ID: "node_py"), 선행=[node_intro], 후행=[node_oop]:
  { "type": "add_node", "node": { "id": "node_py_var", "name": "변수와 자료형", ... } }
  { "type": "add_node", "node": { "id": "node_py_fn",  "name": "함수와 제어흐름", ... } }
  { "type": "add_node", "node": { "id": "node_py_cls", "name": "클래스와 객체", ... } }
  { "type": "add_edge", "edge": { "from": "node_intro",  "to": "node_py_var" } }
  { "type": "add_edge", "edge": { "from": "node_py_var", "to": "node_py_fn"  } }
  { "type": "add_edge", "edge": { "from": "node_py_fn",  "to": "node_py_cls" } }
  { "type": "add_edge", "edge": { "from": "node_py_cls", "to": "node_oop"    } }
  { "type": "remove_node", "nodeId": "node_py" }

━━ 구체 예시 (병렬) ━━
원본 "선형대수학"(ID: "node_la"), 선행=[node_calculus], 후행=[node_ml]:
  { "type": "add_node", "node": { "id": "node_la_vec", "name": "벡터 연산", ... } }
  { "type": "add_node", "node": { "id": "node_la_mat", "name": "행렬 연산", ... } }
  { "type": "add_node", "node": { "id": "node_la_eig", "name": "고유값 분해", ... } }
  { "type": "add_edge", "edge": { "from": "node_calculus", "to": "node_la_vec" } }
  { "type": "add_edge", "edge": { "from": "node_calculus", "to": "node_la_mat" } }
  { "type": "add_edge", "edge": { "from": "node_calculus", "to": "node_la_eig" } }
  { "type": "add_edge", "edge": { "from": "node_la_vec",   "to": "node_ml"    } }
  { "type": "add_edge", "edge": { "from": "node_la_mat",   "to": "node_ml"    } }
  { "type": "add_edge", "edge": { "from": "node_la_eig",   "to": "node_ml"    } }
  { "type": "remove_node", "nodeId": "node_la" }

━━━ 응답 형식 ━━━
{
  "id": "patch_1",
  "reason": "변경 이유 설명",
  "expectedBaseVersion": 현재_버전_번호,
  "operations": [ ...ops... ]
}`;

export function buildGraphPatchUserPrompt(
  project: StudyProject,
  instruction: string,
  referencedNodeIds?: string[]
): string {
  const nodes = project.nodes;
  const edges = project.edges;

  // Build predecessor/successor maps from edges
  const predecessors: Record<string, string[]> = {};
  const successors: Record<string, string[]> = {};
  for (const nodeId of Object.keys(nodes)) {
    predecessors[nodeId] = [];
    successors[nodeId] = [];
  }
  for (const e of edges) {
    if (nodes[e.from] && nodes[e.to]) {
      successors[e.from]?.push(e.to);
      predecessors[e.to]?.push(e.from);
    }
  }

  // Capstone context
  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
  const capstoneSection = activeCapstone
    ? `━━━ 캡스톤 학습 목표 ━━━
제목: ${activeCapstone.title}
설명: ${activeCapstone.description}
성공 기준: ${activeCapstone.successCriteria}
`
    : '';

  // Per-node detailed info
  const nodeDetails = Object.values(nodes)
    .map((n) => {
      const preds = (predecessors[n.id] ?? []).map((id) => `"${nodes[id]?.name ?? id}" (ID: ${id})`);
      const succs = (successors[n.id] ?? []).map((id) => `"${nodes[id]?.name ?? id}" (ID: ${id})`);
      // Also include capstone successor if any
      const capstoneSucEdges = edges.filter((e) => e.from === n.id && project.capstones.some((c) => c.id === e.to));
      const capSuccStr = capstoneSucEdges.map((e) => {
        const cap = project.capstones.find((c) => c.id === e.to);
        return cap ? `"${cap.title}" [캡스톤] (ID: ${e.to})` : null;
      }).filter(Boolean);

      const allSuccStr = [...succs, ...capSuccStr];

      return [
        `▸ ID: "${n.id}"`,
        `  이름: ${n.name}`,
        `  상태: ${n.status}`,
        `  요약: ${n.summary || '(없음)'}`,
        `  선행 노드: ${preds.length > 0 ? preds.join(', ') : '없음 (시작 노드)'}`,
        `  후행 노드: ${allSuccStr.length > 0 ? allSuccStr.join(', ') : '없음 (끝 노드)'}`,
      ].join('\n');
    })
    .join('\n\n');

  // Referenced nodes detail section
  let refSection = '';
  if (referencedNodeIds && referencedNodeIds.length > 0) {
    const refs = referencedNodeIds
      .map((id) => {
        const n = nodes[id];
        if (!n) return null;
        const preds = (predecessors[id] ?? []).map((pid) => `"${nodes[pid]?.name ?? pid}" (ID: ${pid})`);
        const succs = (successors[id] ?? []).map((sid) => `"${nodes[sid]?.name ?? sid}" (ID: ${sid})`);
        return [
          `  ID: "${id}"`,
          `  이름: ${n.name}`,
          `  요약: ${n.summary || '(없음)'}`,
          `  선행: ${preds.length > 0 ? preds.join(', ') : '없음'}`,
          `  후행: ${succs.length > 0 ? succs.join(', ') : '없음'}`,
        ].join('\n');
      })
      .filter(Boolean)
      .join('\n---\n');

    if (refs) {
      refSection = `
━━━ 사용자가 참조한 노드 (우선 조작 대상) ━━━
${refs}
`;
    }
  }

  return `${capstoneSection}
━━━ 그래프 현황 ━━━
버전: ${project.graphVersion} | 노드 수: ${Object.keys(nodes).length} | 엣지 수: ${edges.length}

━━━ 노드 전체 상세 목록 (ID를 정확히 사용하세요) ━━━
${nodeDetails || '(노드 없음)'}
${refSection}
━━━ 사용자 지시 ━━━
${instruction}

위 지시에 따라 GraphPatch를 생성하세요. 규칙:
- expectedBaseVersion은 반드시 ${project.graphVersion}
- nodeId/targetNodeId 등에는 위 목록의 정확한 ID 값 사용
- 새 노드 ID는 "node_" 접두어로 시작하는 고유한 값 사용
- 노드 요약(summary)은 학습자가 해당 주제에서 습득할 내용을 1~2문장으로 작성`;
}
