import React, { useState, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { DagCanvas } from '../components/dag-canvas/DagCanvas';
import { NodeInspector } from '../components/inspector/NodeInspector';
import { PatchPreview } from '../components/patch/PatchPreview';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { generateGraphPatch } from '../services/llmGateway';
import { validatePatch, getPatchDiff } from '../domain/graphPatch';
import { getModelConfig } from '../domain/types';

export function DagWorkspacePage() {
  const { state, dispatch } = useApp();
  const { project, canvas, selectedNodeId, patchPreview, llm } = state;

  const [commandText, setCommandText] = useState('');
  const [commandError, setCommandError] = useState('');
  const [patchErrors, setPatchErrors] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!project) {
    return (
      <div className="h-full bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">프로젝트를 불러올 수 없습니다.</div>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? project.nodes[selectedNodeId] : null;
  const completedCount = Object.values(project.nodes).filter((n) => n.status === 'completed').length;
  const totalCount = Object.values(project.nodes).filter((n) => n.status !== 'excluded').length;
  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
  const allReadyForCapstone =
    totalCount > 0 &&
    Object.values(project.nodes)
      .filter((n) => n.status !== 'excluded')
      .every((n) => n.status === 'completed');

  const patchDiff = useMemo(() => {
    if (!patchPreview || !project) return null;
    return getPatchDiff(patchPreview, project);
  }, [patchPreview, project]);

  // ── Canvas callbacks ──────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      dispatch({ type: 'SELECT_NODE', nodeId });
    },
    [dispatch]
  );

  const handleDeselectAll = useCallback(
    () => dispatch({ type: 'SELECT_NODE', nodeId: undefined }),
    [dispatch]
  );

  const handleConnect = useCallback(
    (from: string, to: string) => {
      dispatch({
        type: 'APPLY_GRAPH_PATCH',
        patch: {
          id: nanoid(),
          reason: `간선 추가: ${project.nodes[from]?.name ?? from} → ${project.nodes[to]?.name ?? to}`,
          operations: [{ type: 'add_edge', edge: { from, to } }],
          expectedBaseVersion: project.graphVersion,
        },
      });
    },
    [dispatch, project]
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      const node = project.nodes[nodeId];
      if (!node) return;
      dispatch({
        type: 'APPLY_GRAPH_PATCH',
        patch: {
          id: nanoid(),
          reason: `노드 제외 (transitive 재연결): ${node.name}`,
          operations: [{ type: 'exclude_node', nodeId }],
          expectedBaseVersion: project.graphVersion,
        },
      });
      if (selectedNodeId === nodeId) {
        dispatch({ type: 'SELECT_NODE', nodeId: undefined });
      }
    },
    [dispatch, project, selectedNodeId]
  );

  const handleRemoveNodes = useCallback(
    (nodeIds: string[]) => {
      const validIds = nodeIds.filter((id) => project.nodes[id]);
      if (validIds.length === 0) return;
      const names = validIds.map((id) => project.nodes[id].name).join(', ');
      dispatch({
        type: 'APPLY_GRAPH_PATCH',
        patch: {
          id: nanoid(),
          reason: `노드 일괄 제외 (transitive 재연결): ${names}`,
          operations: validIds.map((nodeId) => ({ type: 'exclude_node' as const, nodeId })),
          expectedBaseVersion: project.graphVersion,
        },
      });
      if (selectedNodeId && validIds.includes(selectedNodeId)) {
        dispatch({ type: 'SELECT_NODE', nodeId: undefined });
      }
    },
    [dispatch, project, selectedNodeId]
  );

  const handleRemoveEdge = useCallback(
    (from: string, to: string) => {
      dispatch({
        type: 'APPLY_GRAPH_PATCH',
        patch: {
          id: nanoid(),
          reason: `간선 제거`,
          operations: [{ type: 'remove_edge', edge: { from, to } }],
          expectedBaseVersion: project.graphVersion,
        },
      });
    },
    [dispatch, project]
  );

  const handleAddNode = useCallback(
    (name: string, summary: string, canvasPos: { x: number; y: number }) => {
      const newId = nanoid();
      dispatch({
        type: 'APPLY_GRAPH_PATCH',
        patch: {
          id: nanoid(),
          reason: `노드 추가: ${name}`,
          operations: [
            {
              type: 'add_node',
              node: {
                id: newId,
                kind: 'knowledge',
                name,
                summary,
                prerequisiteNodeIds: [],
                status: 'waiting',
                testGoalStatus: 'none',
                notes: [],
                createdBy: 'user',
              },
            },
          ],
          expectedBaseVersion: project.graphVersion,
        },
      });
      // Set position for the new node
      dispatch({
        type: 'UPDATE_CANVAS_STATE',
        canvas: {
          nodePositions: { ...canvas.nodePositions, [newId]: canvasPos },
        },
      });
    },
    [dispatch, project, canvas.nodePositions]
  );

  const handleRequestTest = useCallback(
    (nodeId: string) => {
      const node = project.nodes[nodeId];
      if (!node) return;
      dispatch({
        type: 'REQUEST_TEST',
        pending: {
          id: nanoid(),
          nodeId,
          nodeName: node.name,
          requestedAt: new Date().toISOString(),
        },
      });
    },
    [dispatch, project]
  );

  const handleSetStatus = useCallback(
    (nodeId: string, status: 'waiting' | 'studying' | 'completed' | 'excluded') => {
      dispatch({ type: 'SET_NODE_STATUS', nodeId, status });
    },
    [dispatch]
  );

  const handleReferenceNodes = useCallback(
    (nodeIds: string[]) => {
      const parts = nodeIds
        .map((id) => {
          const n = project.nodes[id];
          return n ? `"${n.name}" (ID: ${id})` : id;
        })
        .filter(Boolean);
      const ref = `[참조 노드: ${parts.join(', ')}]`;
      setCommandText((prev) => (prev ? `${prev}\n${ref}` : ref));
    },
    [project]
  );

  // ── Command panel ─────────────────────────────────────────────────────────

  const handleRunCommand = async () => {
    if (!commandText.trim()) return;
    setCommandError('');
    setPatchErrors([]);
    dispatch({ type: 'SET_LLM_LOADING', operation: 'graph_patch' });
    try {
      const config = getModelConfig(state);
      // Extract referenced node IDs from [참조 노드: ...] markers in command text
      const refMatches = commandText.match(/\(ID:\s*([^)]+)\)/g) ?? [];
      const referencedNodeIds = refMatches
        .map((m) => m.replace(/\(ID:\s*/, '').replace(')', '').trim())
        .filter((id) => project.nodes[id]);
      const patch = await generateGraphPatch(
        project,
        commandText,
        config,
        referencedNodeIds.length > 0 ? referencedNodeIds : undefined
      );
      dispatch({ type: 'SET_PATCH_PREVIEW', patch });
    } catch (e) {
      setCommandError(e instanceof Error ? e.message : '패치 생성 실패');
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  };

  const handleApplyPatch = () => {
    if (!patchPreview) return;
    const { valid, errors } = validatePatch(patchPreview, project);
    if (!valid) {
      setPatchErrors(errors);
      return;
    }
    setIsApplying(true);
    dispatch({ type: 'APPLY_GRAPH_PATCH', patch: patchPreview });
    setCommandText('');
    setIsApplying(false);
  };

  const handleDiscardPatch = () => {
    dispatch({ type: 'SET_PATCH_PREVIEW', patch: undefined });
    setPatchErrors([]);
  };

  return (
    <div className="h-full bg-gray-950 flex flex-col overflow-hidden">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-gray-100 text-sm truncate max-w-xs">{project.title}</h1>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
            v{project.graphVersion}
          </span>
          {patchPreview && (
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded border border-amber-700">
              미리보기 모드
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            완료 {completedCount}/{totalCount}
          </span>
          {allReadyForCapstone && activeCapstone && (
            <Button
              size="sm"
              variant="success"
              onClick={() => dispatch({ type: 'START_CAPSTONE_ATTEMPT' })}
            >
              캡스톤 도전
            </Button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">프로젝트를 삭제하시겠습니까?</span>
              <button
                onClick={() => {
                  dispatch({ type: 'DELETE_PROJECT', projectId: project.id });
                }}
                className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
              >
                삭제
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="프로젝트 삭제"
              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {llm.isLoading && (
            <div className="absolute inset-0 z-10 bg-gray-950/70 flex items-center justify-center">
              <LoadingSpinner
                message={
                  llm.operation === 'graph_patch' ? '그래프 패치 생성 중...' : '처리 중...'
                }
              />
            </div>
          )}
          <DagCanvas
            project={project}
            canvas={canvas}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            onDeselectAll={handleDeselectAll}
            onConnect={handleConnect}
            onRemoveNode={handleRemoveNode}
            onRemoveEdge={handleRemoveEdge}
            onRemoveNodes={handleRemoveNodes}
            onRequestTest={handleRequestTest}
            onAddNode={handleAddNode}
            onReferenceNodes={handleReferenceNodes}
            patchDiff={patchDiff}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Node Inspector */}
          <div className="flex-1 overflow-y-auto border-b border-gray-800">
            {selectedNode ? (
              <NodeInspector
                node={selectedNode}
                project={project}
                onRequestTest={handleRequestTest}
                onSetStatus={handleSetStatus}
              />
            ) : (
              <div className="p-4 text-center text-gray-600 text-sm pt-10">
                노드를 클릭하면
                <br />
                상세 정보가 표시됩니다
              </div>
            )}
          </div>

          {/* Command Panel */}
          <div className="p-3 flex flex-col gap-2 flex-shrink-0">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              그래프 수정 (자연어)
            </div>
            <textarea
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder={`예: '파이썬 기초를 변수, 함수, 클래스로 분리해줘'`}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            {commandError && (
              <div className="text-xs text-red-400 bg-red-950 rounded p-2">{commandError}</div>
            )}
            {patchErrors.length > 0 && (
              <div className="text-xs text-orange-400 bg-orange-950 rounded p-2">
                {patchErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {patchPreview ? (
              <PatchPreview
                patch={patchPreview}
                onApply={handleApplyPatch}
                onDiscard={handleDiscardPatch}
                isApplying={isApplying}
              />
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRunCommand}
                loading={llm.isLoading && llm.operation === 'graph_patch'}
                disabled={!commandText.trim()}
                className="w-full justify-center"
              >
                패치 생성
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
