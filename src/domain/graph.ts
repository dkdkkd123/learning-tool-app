import type { NodeId, KnowledgeNode, Edge, StudyProject } from './types';

export function topologicalSort(nodes: Record<NodeId, KnowledgeNode>, edges: Edge[]): NodeId[] {
  const ids = Object.keys(nodes);
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const id of ids) {
    inDegree[id] = 0;
    adj[id] = [];
  }

  for (const edge of edges) {
    if (adj[edge.from] !== undefined) {
      adj[edge.from].push(edge.to);
    }
    if (inDegree[edge.to] !== undefined) {
      inDegree[edge.to]++;
    }
  }

  const queue: string[] = ids.filter((id) => inDegree[id] === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj[node] ?? []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Append any not reached (cycle members)
  for (const id of ids) {
    if (!result.includes(id)) result.push(id);
  }

  return result;
}

export function detectCycle(nodes: Record<NodeId, KnowledgeNode>, edges: Edge[]): boolean {
  const ids = Object.keys(nodes);
  const color: Record<string, 'white' | 'gray' | 'black'> = {};
  for (const id of ids) color[id] = 'white';

  const adj: Record<string, string[]> = {};
  for (const id of ids) adj[id] = [];
  for (const edge of edges) {
    if (adj[edge.from]) adj[edge.from].push(edge.to);
  }

  function dfs(u: string): boolean {
    color[u] = 'gray';
    for (const v of adj[u] ?? []) {
      if (color[v] === 'gray') return true;
      if (color[v] === 'white' && dfs(v)) return true;
    }
    color[u] = 'black';
    return false;
  }

  for (const id of ids) {
    if (color[id] === 'white' && dfs(id)) return true;
  }
  return false;
}

export function getReadyNodes(nodes: Record<NodeId, KnowledgeNode>, edges: Edge[]): NodeId[] {
  return Object.values(nodes)
    .filter((node) => {
      if (node.status !== 'waiting') return false;
      return node.prerequisiteNodeIds.every((preId) => {
        const pre = nodes[preId];
        return pre?.status === 'completed' || pre?.status === 'excluded';
      });
    })
    .map((n) => n.id);
}

export function getAffectedDescendants(nodeIds: string[], edges: Edge[]): string[] {
  const visited = new Set<string>();
  const queue = [...nodeIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === current && !visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return Array.from(visited);
}

export function validateGraphInvariants(project: StudyProject): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { nodes, edges, capstones } = project;

  // 1. No cycles
  if (detectCycle(nodes, edges)) {
    errors.push('그래프에 순환이 존재합니다.');
  }

  // 2. All prerequisiteNodeIds in node reference existing nodes
  for (const node of Object.values(nodes)) {
    for (const preId of node.prerequisiteNodeIds) {
      if (!nodes[preId]) {
        errors.push(`노드 ${node.id}의 선행 노드 ${preId}가 존재하지 않습니다.`);
      }
    }
  }

  // 3. All edges reference existing nodes
  for (const edge of edges) {
    if (!nodes[edge.from]) {
      errors.push(`엣지의 출발 노드 ${edge.from}가 존재하지 않습니다.`);
    }
    if (!nodes[edge.to]) {
      errors.push(`엣지의 도착 노드 ${edge.to}가 존재하지 않습니다.`);
    }
  }

  // 4. Edges consistent with prerequisiteNodeIds
  for (const node of Object.values(nodes)) {
    for (const preId of node.prerequisiteNodeIds) {
      const hasEdge = edges.some((e) => e.from === preId && e.to === node.id);
      if (!hasEdge) {
        errors.push(`노드 ${node.id}의 선행 노드 ${preId}에 대한 엣지가 없습니다.`);
      }
    }
  }

  // 5. Active capstone exists
  if (project.activeCapstoneId) {
    const capstone = capstones.find((c) => c.id === project.activeCapstoneId);
    if (!capstone) {
      errors.push(`활성 캡스톤 ${project.activeCapstoneId}가 존재하지 않습니다.`);
    }
  }

  // 6. No duplicate node IDs
  const nodeIds = Object.keys(nodes);
  const uniqueIds = new Set(nodeIds);
  if (nodeIds.length !== uniqueIds.size) {
    errors.push('중복된 노드 ID가 존재합니다.');
  }

  // 7. No duplicate edges
  const edgeKeys = edges.map((e) => `${e.from}->${e.to}`);
  const uniqueEdges = new Set(edgeKeys);
  if (edgeKeys.length !== uniqueEdges.size) {
    errors.push('중복된 엣지가 존재합니다.');
  }

  return { valid: errors.length === 0, errors };
}

export function computeLayeredLayout(
  nodes: Record<NodeId, KnowledgeNode>,
  edges: Edge[]
): Record<NodeId, { x: number; y: number }> {
  const sorted = topologicalSort(nodes, edges);
  const layer: Record<string, number> = {};

  for (const id of sorted) {
    const preds = edges.filter((e) => e.to === id).map((e) => e.from);
    layer[id] = preds.length === 0 ? 0 : Math.max(...preds.map((p) => (layer[p] ?? 0) + 1));
  }

  const byLayer: Record<number, string[]> = {};
  for (const id of sorted) {
    const l = layer[id] ?? 0;
    if (!byLayer[l]) byLayer[l] = [];
    byLayer[l].push(id);
  }

  const positions: Record<NodeId, { x: number; y: number }> = {};
  const NODE_W = 220;
  const NODE_H = 120;
  const GAP_X = 60;
  const GAP_Y = 40;

  const maxPerLayer = Math.max(...Object.values(byLayer).map((arr) => arr.length));

  for (const [lStr, ids] of Object.entries(byLayer)) {
    const l = Number(lStr);
    const totalH = ids.length * NODE_H + (ids.length - 1) * GAP_Y;
    const startY = ((maxPerLayer * (NODE_H + GAP_Y) - totalH) / 2);
    ids.forEach((id, i) => {
      positions[id] = {
        x: l * (NODE_W + GAP_X) + 40,
        y: startY + i * (NODE_H + GAP_Y) + 40,
      };
    });
  }

  return positions;
}
