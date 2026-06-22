import { nanoid } from 'nanoid';
import type { GraphPatch, StudyProject, KnowledgeNode, Edge } from './types';
import { detectCycle } from './graph';

export function validatePatch(
  patch: GraphPatch,
  project: StudyProject
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (patch.expectedBaseVersion !== project.graphVersion) {
    errors.push(
      `버전 불일치: 패치는 버전 ${patch.expectedBaseVersion}을 기대하지만 현재 버전은 ${project.graphVersion}입니다.`
    );
  }

  if (!patch.reason || patch.reason.trim() === '') {
    errors.push('패치에 이유(reason)가 없습니다.');
  }

  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    errors.push('패치에 작업(operations)이 없습니다.');
  }

  // Simulate apply to check validity
  try {
    const simulated = applyPatchToProject(patch, project, true);
    if (detectCycle(simulated.nodes, simulated.edges)) {
      errors.push('패치 적용 시 순환이 발생합니다.');
    }
  } catch (e: unknown) {
    errors.push(`패치 시뮬레이션 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { valid: errors.length === 0, errors };
}

export function applyPatch(patch: GraphPatch, project: StudyProject): StudyProject {
  const updated = applyPatchToProject(patch, project, false);
  updated.graphVersion = project.graphVersion + 1;
  updated.updatedAt = new Date().toISOString();
  updated.events = [
    ...project.events,
    {
      id: nanoid(),
      type: 'graph_patch',
      summary: patch.reason,
      graphVersion: updated.graphVersion,
      createdAt: new Date().toISOString(),
    },
  ];
  return updated;
}

function applyPatchToProject(
  patch: GraphPatch,
  project: StudyProject,
  _simulate: boolean
): StudyProject {
  let nodes = { ...project.nodes };
  let edges = [...project.edges];
  const now = new Date().toISOString();

  for (const op of patch.operations) {
    switch (op.type) {
      case 'add_node': {
        const node: KnowledgeNode = {
          ...op.node,
          createdAt: now,
          updatedAt: now,
        };
        nodes[node.id] = node;
        // Add edges for prerequisites
        for (const preId of node.prerequisiteNodeIds) {
          if (!edges.some((e) => e.from === preId && e.to === node.id)) {
            edges.push({ from: preId, to: node.id });
          }
        }
        break;
      }
      case 'update_node': {
        if (!nodes[op.nodeId]) throw new Error(`노드 ${op.nodeId}가 존재하지 않습니다.`);
        nodes[op.nodeId] = { ...nodes[op.nodeId], ...op.updates, updatedAt: now };
        break;
      }
      case 'remove_node': {
        delete nodes[op.nodeId];
        edges = edges.filter((e) => e.from !== op.nodeId && e.to !== op.nodeId);
        break;
      }
      case 'exclude_node': {
        if (!nodes[op.nodeId]) throw new Error(`노드 ${op.nodeId}가 존재하지 않습니다.`);
        nodes[op.nodeId] = { ...nodes[op.nodeId], status: 'excluded', updatedAt: now };
        break;
      }
      case 'add_edge': {
        if (!edges.some((e) => e.from === op.edge.from && e.to === op.edge.to)) {
          edges.push(op.edge);
        }
        break;
      }
      case 'remove_edge': {
        edges = edges.filter((e) => !(e.from === op.edge.from && e.to === op.edge.to));
        break;
      }
      case 'split_node': {
        const original = nodes[op.targetNodeId];
        if (!original) throw new Error(`노드 ${op.targetNodeId}가 존재하지 않습니다.`);
        delete nodes[op.targetNodeId];
        edges = edges.filter((e) => e.from !== op.targetNodeId && e.to !== op.targetNodeId);
        for (const rn of op.replacementNodes) {
          const newNode: KnowledgeNode = {
            id: rn.id ?? nanoid(),
            kind: 'knowledge',
            name: rn.name ?? '새 노드',
            summary: rn.summary ?? '',
            prerequisiteNodeIds: rn.prerequisiteNodeIds ?? [],
            status: rn.status ?? 'waiting',
            testGoalStatus: rn.testGoalStatus ?? 'none',
            notes: rn.notes ?? [],
            createdBy: 'llm',
            createdAt: now,
            updatedAt: now,
          };
          nodes[newNode.id] = newNode;
        }
        for (const re of op.replacementEdges) {
          if (!edges.some((e) => e.from === re.from && e.to === re.to)) {
            edges.push(re);
          }
        }
        break;
      }
      case 'merge_nodes': {
        for (const srcId of op.sourceNodeIds) {
          delete nodes[srcId];
          edges = edges.filter((e) => e.from !== srcId && e.to !== srcId);
        }
        const merged: KnowledgeNode = {
          id: op.newNode.id ?? nanoid(),
          kind: 'knowledge',
          name: op.newNode.name ?? '병합된 노드',
          summary: op.newNode.summary ?? '',
          prerequisiteNodeIds: op.newNode.prerequisiteNodeIds ?? [],
          status: op.newNode.status ?? 'waiting',
          testGoalStatus: op.newNode.testGoalStatus ?? 'none',
          notes: op.newNode.notes ?? [],
          createdBy: 'llm',
          createdAt: now,
          updatedAt: now,
        };
        nodes[merged.id] = merged;
        for (const preId of merged.prerequisiteNodeIds) {
          if (!edges.some((e) => e.from === preId && e.to === merged.id)) {
            edges.push({ from: preId, to: merged.id });
          }
        }
        break;
      }
      case 'replace_subgraph': {
        for (const tId of op.targetNodeIds) {
          delete nodes[tId];
          edges = edges.filter((e) => e.from !== tId && e.to !== tId);
        }
        for (const nn of op.newNodes) {
          const newNode: KnowledgeNode = {
            id: nn.id ?? nanoid(),
            kind: 'knowledge',
            name: nn.name ?? '새 노드',
            summary: nn.summary ?? '',
            prerequisiteNodeIds: nn.prerequisiteNodeIds ?? [],
            status: nn.status ?? 'waiting',
            testGoalStatus: nn.testGoalStatus ?? 'none',
            notes: nn.notes ?? [],
            createdBy: 'llm',
            createdAt: now,
            updatedAt: now,
          };
          nodes[newNode.id] = newNode;
        }
        for (const ne of op.newEdges) {
          if (!edges.some((e) => e.from === ne.from && e.to === ne.to)) {
            edges.push(ne);
          }
        }
        break;
      }
    }
  }

  // Sync edges — keep edges between knowledge nodes and edges from knowledge nodes to capstone
  const capstoneIds = new Set(project.capstones.map((c) => c.id));
  const finalEdges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    if (!edgeSet.has(key) && nodes[edge.from] && (nodes[edge.to] || capstoneIds.has(edge.to))) {
      edgeSet.add(key);
      finalEdges.push(edge);
    }
  }

  return { ...project, nodes, edges: finalEdges };
}
