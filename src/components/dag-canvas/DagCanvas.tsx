import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge as FlowEdge,
  type NodeChange,
  type Connection,
  type OnSelectionChangeParams,
  BackgroundVariant,
  Panel,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StudyProject, CanvasState, KnowledgeNode } from '../../domain/types';
import type { PatchDiff } from '../../domain/graphPatch';
import { computeLayeredLayout } from '../../domain/graph';
import { KnowledgeNodeCard } from './KnowledgeNodeCard';
import { CapstoneNodeCard } from './CapstoneNodeCard';
import { useApp } from '../../context/AppContext';

const nodeTypes = {
  knowledge: KnowledgeNodeCard,
  capstone: CapstoneNodeCard,
};

type ContextMenuState = {
  type: 'node' | 'edge' | 'pane';
  x: number;
  y: number;
  nodeId?: string;
  from?: string;
  to?: string;
  canvasX?: number;
  canvasY?: number;
} | null;

type AddNodeForm = {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  name: string;
  summary: string;
} | null;

type Props = {
  project: StudyProject;
  canvas: CanvasState;
  selectedNodeId?: string;
  onNodeClick: (nodeId: string) => void;
  onDeselectAll: () => void;
  onConnect: (from: string, to: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onRemoveEdge: (from: string, to: string) => void;
  onRemoveNodes: (nodeIds: string[]) => void;
  onRequestTest: (nodeId: string) => void;
  onAddNode: (name: string, summary: string, canvasPos: { x: number; y: number }) => void;
  onReferenceNodes: (nodeIds: string[]) => void;
  patchDiff?: PatchDiff | null;
};

export function DagCanvas({
  project,
  canvas,
  selectedNodeId,
  onNodeClick,
  onDeselectAll,
  onConnect,
  onRemoveNode,
  onRemoveEdge,
  onRemoveNodes,
  onRequestTest,
  onAddNode,
  onReferenceNodes,
  patchDiff,
}: Props) {
  const { dispatch } = useApp();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [addNodeForm, setAddNodeForm] = useState<AddNodeForm>(null);
  // Local-only selection state — never fed back into flowNodes to avoid feedback loops
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeKeys, setSelectedEdgeKeys] = useState<string[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu && !addNodeForm) return;
    function close() {
      setContextMenu(null);
      setAddNodeForm(null);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu, addNodeForm]);

  // When patch preview is active, compute topology-sorted positions for new nodes
  // so they don't all pile up at (0,0).
  const patchPreviewLayout = useMemo<Record<string, { x: number; y: number }> | null>(() => {
    if (!patchDiff) return null;
    const knowledgeEdges = patchDiff.simulatedEdges.filter(
      (e) => patchDiff.simulatedNodes[e.from] && patchDiff.simulatedNodes[e.to]
    );
    return computeLayeredLayout(patchDiff.simulatedNodes, knowledgeEdges);
  }, [patchDiff]);

  // flowNodes does NOT include `selected` or `isSelected` — selection is managed
  // entirely by React Flow internally to avoid the feedback loop that caused all 3 bugs.
  const flowNodes = useMemo<Node[]>(() => {
    const result: Node[] = [];
    const displayNodes: Record<string, KnowledgeNode & { _previewHighlight?: 'added' | 'removed' }> = {};

    if (patchDiff) {
      for (const [id, node] of Object.entries(patchDiff.simulatedNodes)) {
        displayNodes[id] = {
          ...node,
          _previewHighlight: patchDiff.addedNodeIds.has(id) ? 'added' : undefined,
        };
      }
      for (const [id, node] of Object.entries(project.nodes)) {
        if (patchDiff.removedNodeIds.has(id)) {
          displayNodes[id] = { ...node, _previewHighlight: 'removed' };
        }
      }
    } else {
      for (const [id, node] of Object.entries(project.nodes)) {
        displayNodes[id] = node;
      }
    }

    for (const [id, node] of Object.entries(displayNodes)) {
      // For patch preview: new nodes use topology-sorted position;
      // existing nodes keep their current canvas position.
      const pos = canvas.nodePositions[id] ?? patchPreviewLayout?.[id] ?? { x: 0, y: 0 };
      result.push({
        id,
        type: 'knowledge',
        position: pos,
        data: {
          node,
          previewHighlight: (node as typeof node & { _previewHighlight?: string })._previewHighlight,
        },
        draggable: true,
      });
    }

    for (const capstone of project.capstones) {
      const pos = canvas.nodePositions[capstone.id] ?? { x: 800, y: 300 };
      result.push({
        id: capstone.id,
        type: 'capstone',
        position: pos,
        data: { node: capstone },
        draggable: true,
      });
    }

    return result;
  }, [project, canvas, patchDiff, patchPreviewLayout]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    const displayEdges = patchDiff ? [...patchDiff.simulatedEdges] : [...project.edges];
    if (patchDiff) {
      for (const e of project.edges) {
        const key = `${e.from}->${e.to}`;
        if (patchDiff.removedEdgeKeys.has(key)) displayEdges.push(e);
      }
    }
    return displayEdges.map((e) => {
      const key = `${e.from}->${e.to}`;
      let stroke = '#4b5563';
      let strokeWidth = 2;
      let strokeDasharray: string | undefined;
      if (patchDiff) {
        if (patchDiff.addedEdgeKeys.has(key)) stroke = '#10b981';
        else if (patchDiff.removedEdgeKeys.has(key)) { stroke = '#ef4444'; strokeDasharray = '6 3'; }
      } else if (selectedNodeId && (e.from === selectedNodeId || e.to === selectedNodeId)) {
        stroke = '#3b82f6';
        strokeWidth = 3;
      }
      return {
        id: key,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        style: { stroke, strokeWidth, strokeDasharray },
        animated: false,
      };
    });
  }, [project.edges, patchDiff, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // When project/canvas changes, rebuild nodes BUT preserve React Flow's internal selection.
  React.useEffect(() => {
    setNodes((prev) => {
      const selMap = new Map(prev.map((n) => [n.id, n.selected ?? false]));
      return flowNodes.map((n) => ({ ...n, selected: selMap.get(n.id) ?? false }));
    });
  }, [flowNodes]);

  React.useEffect(() => {
    setEdges((prev) => {
      const selMap = new Map(prev.map((e) => [e.id, e.selected ?? false]));
      return flowEdges.map((e) => ({ ...e, selected: selMap.get(e.id) ?? false }));
    });
  }, [flowEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const posUpdates: Record<string, { x: number; y: number }> = {};
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          posUpdates[change.id] = change.position;
        }
      }
      if (Object.keys(posUpdates).length > 0) {
        dispatch({
          type: 'UPDATE_CANVAS_STATE',
          canvas: { nodePositions: { ...canvas.nodePositions, ...posUpdates }, layoutMode: 'manual' },
        });
      }
    },
    [onNodesChange, dispatch, canvas.nodePositions]
  );

  // Selection is tracked only in local state — never dispatched back to cause re-renders.
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      setSelectedNodeIds(selNodes.map((n) => n.id));
      setSelectedEdgeKeys(selEdges.map((e) => e.id));
    },
    []
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      dispatch({ type: 'UPDATE_CANVAS_STATE', canvas: { viewport } });
    },
    [dispatch]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onConnect(connection.source, connection.target);
      }
    },
    [onConnect]
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ type: 'node', x: e.clientX, y: e.clientY, nodeId: node.id });
    },
    []
  );

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: FlowEdge) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ type: 'edge', x: e.clientX, y: e.clientY, from: edge.source, to: edge.target });
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    onDeselectAll();
  }, [onDeselectAll]);

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const zoom = canvas.viewport.zoom;
      const canvasX = (e.clientX - rect.left - canvas.viewport.x) / zoom;
      const canvasY = (e.clientY - rect.top - canvas.viewport.y) / zoom;
      setContextMenu({ type: 'pane', x: e.clientX, y: e.clientY, canvasX, canvasY });
    },
    [canvas.viewport]
  );

  const contextMenuNode = contextMenu?.nodeId ? project.nodes[contextMenu.nodeId] : null;

  const isMultiNodeSelection =
    contextMenu?.type === 'node' &&
    contextMenu.nodeId != null &&
    selectedNodeIds.length > 1 &&
    selectedNodeIds.includes(contextMenu.nodeId);

  const hasMultiSelection = selectedNodeIds.length > 1 || selectedEdgeKeys.length > 1 ||
    (selectedNodeIds.length >= 1 && selectedEdgeKeys.length >= 1);

  const deletableSelectedNodeIds = selectedNodeIds.filter(
    (id) => project.nodes[id] && !project.capstones.some((c) => c.id === id)
  );

  const referenceTargetIds = isMultiNodeSelection
    ? selectedNodeIds.filter((id) => project.nodes[id])
    : contextMenu?.nodeId
      ? [contextMenu.nodeId]
      : [];

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onConnect={handleConnect}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        defaultViewport={canvas.viewport}
        fitView={canvas.viewport.x === 0 && canvas.viewport.y === 0}
        minZoom={0.2}
        maxZoom={2}
        className="bg-gray-950"
        connectOnClick={false}
        selectionOnDrag={true}
        panOnDrag={[1]}
        selectionMode={SelectionMode.Partial}
      >
        <Background color="#374151" gap={20} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-gray-800 !border-gray-700" />
        <MiniMap
          className="!bg-gray-900 !border-gray-700"
          nodeColor={(n) => {
            const data = n.data as { node?: { status?: string }; previewHighlight?: string };
            if (data?.previewHighlight === 'added') return '#10b981';
            if (data?.previewHighlight === 'removed') return '#ef4444';
            const status = data?.node?.status;
            if (status === 'completed') return '#059669';
            if (status === 'studying') return '#ca8a04';
            if (n.type === 'capstone') return '#7c3aed';
            return '#374151';
          }}
        />
        <Panel position="top-left" className="flex flex-col gap-1">
          <button
            onClick={() => dispatch({ type: 'RESET_LAYOUT' })}
            title="위상 정렬 재배치"
            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 text-xs flex items-center justify-center transition-colors"
          >
            ⇅
          </button>
        </Panel>
        {hasMultiSelection && (
          <Panel position="bottom-center">
            <div className="bg-gray-900/90 border border-gray-700 text-gray-400 text-xs px-3 py-1.5 rounded-full pointer-events-none select-none">
              노드 {selectedNodeIds.length}개
              {selectedEdgeKeys.length > 0 ? ` · 간선 ${selectedEdgeKeys.length}개` : ''} 선택됨 · 우클릭으로 일괄 작업
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
          className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'node' && contextMenuNode && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-700 truncate max-w-[220px]">
                {isMultiNodeSelection ? `${selectedNodeIds.length}개 노드 선택됨` : contextMenuNode.name}
              </div>
              {!isMultiNodeSelection && (
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  onClick={() => { onRequestTest(contextMenu.nodeId!); setContextMenu(null); }}
                >
                  테스트 신청
                </button>
              )}
              <button
                className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors"
                onClick={() => { onReferenceNodes(referenceTargetIds); setContextMenu(null); }}
              >
                {isMultiNodeSelection
                  ? `선택된 ${referenceTargetIds.length}개 노드 프롬프트에 참조`
                  : '이 노드를 프롬프트에 참조'}
              </button>
              {isMultiNodeSelection && deletableSelectedNodeIds.length > 0 && (
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    onRemoveNodes(deletableSelectedNodeIds);
                    setSelectedNodeIds([]);
                    setSelectedEdgeKeys([]);
                    setContextMenu(null);
                  }}
                >
                  선택된 {deletableSelectedNodeIds.length}개 노드 일괄 제거
                </button>
              )}
              {!isMultiNodeSelection && (
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  onClick={() => { onRemoveNode(contextMenu.nodeId!); setContextMenu(null); }}
                >
                  노드 제거 (transitive 재연결)
                </button>
              )}
            </>
          )}
          {contextMenu.type === 'edge' && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-700">연결</div>
              <button
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                onClick={() => { onRemoveEdge(contextMenu.from!, contextMenu.to!); setContextMenu(null); }}
              >
                연결 제거
              </button>
            </>
          )}
          {contextMenu.type === 'pane' && (
            <>
              {hasMultiSelection && (
                <>
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-700">
                    노드 {selectedNodeIds.length}개
                    {selectedEdgeKeys.length > 0 ? ` · 간선 ${selectedEdgeKeys.length}개` : ''} 선택됨
                  </div>
                  {selectedNodeIds.filter((id) => project.nodes[id]).length > 0 && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        onReferenceNodes(selectedNodeIds.filter((id) => project.nodes[id]));
                        setContextMenu(null);
                      }}
                    >
                      선택된 노드들 프롬프트에 참조
                    </button>
                  )}
                  {deletableSelectedNodeIds.length > 0 && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        onRemoveNodes(deletableSelectedNodeIds);
                        setSelectedNodeIds([]);
                        setSelectedEdgeKeys([]);
                        setContextMenu(null);
                      }}
                    >
                      선택된 {deletableSelectedNodeIds.length}개 노드 일괄 제거
                    </button>
                  )}
                  <div className="border-t border-gray-700 my-1" />
                </>
              )}
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddNodeForm({
                    x: contextMenu.x,
                    y: contextMenu.y,
                    canvasX: contextMenu.canvasX ?? 0,
                    canvasY: contextMenu.canvasY ?? 0,
                    name: '',
                    summary: '',
                  });
                  setContextMenu(null);
                }}
              >
                새 노드 추가
              </button>
            </>
          )}
        </div>
      )}

      {/* Add Node Form */}
      {addNodeForm && (
        <div
          style={{ position: 'fixed', left: addNodeForm.x, top: addNodeForm.y, zIndex: 1000 }}
          className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 w-72"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-gray-400 mb-3">새 노드 추가</div>
          <input
            autoFocus
            value={addNodeForm.name}
            onChange={(e) => setAddNodeForm((f) => f ? { ...f, name: e.target.value } : f)}
            placeholder="노드 이름"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            onKeyDown={(e) => e.key === 'Escape' && setAddNodeForm(null)}
          />
          <textarea
            value={addNodeForm.summary}
            onChange={(e) => setAddNodeForm((f) => f ? { ...f, summary: e.target.value } : f)}
            placeholder="노드 설명 (선택)"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 resize-none"
          />
          <div className="flex gap-2">
            <button
              className="flex-1 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              onClick={() => {
                if (addNodeForm.name.trim()) {
                  onAddNode(addNodeForm.name.trim(), addNodeForm.summary.trim(), {
                    x: addNodeForm.canvasX,
                    y: addNodeForm.canvasY,
                  });
                }
                setAddNodeForm(null);
              }}
            >
              추가
            </button>
            <button
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
              onClick={() => setAddNodeForm(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
