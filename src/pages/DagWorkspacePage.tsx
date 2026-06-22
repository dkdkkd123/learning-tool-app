import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { DagCanvas } from '../components/dag-canvas/DagCanvas';
import { NodeInspector } from '../components/inspector/NodeInspector';
import { PatchPreview } from '../components/patch/PatchPreview';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { generateGraphPatch, generateExam, generateTestGoal } from '../services/llmGateway';
import { validatePatch, applyPatch } from '../domain/graphPatch';
import { getReadyNodes } from '../domain/graph';
import type { KnowledgeNode } from '../domain/types';
import { nanoid } from 'nanoid';

export function DagWorkspacePage() {
  const { state, dispatch } = useApp();
  const { project, canvas, selectedNodeId, patchPreview, llm } = state;

  const [commandText, setCommandText] = useState('');
  const [commandError, setCommandError] = useState('');
  const [patchErrors, setPatchErrors] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">프로젝트를 불러올 수 없습니다.</div>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? project.nodes[selectedNodeId] : null;
  const readyNodes = getReadyNodes(project.nodes, project.edges);
  const completedCount = Object.values(project.nodes).filter((n) => n.status === 'completed').length;
  const totalCount = Object.values(project.nodes).filter((n) => n.status !== 'excluded').length;

  const handleNodeClick = useCallback((nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', nodeId });
  }, [dispatch]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', nodeId });
    // Start node if waiting and ready
    const node = project.nodes[nodeId];
    if (node && node.status === 'waiting') {
      dispatch({ type: 'START_NODE', nodeId });
    }
    dispatch({ type: 'NAVIGATE', view: 'node-study' });
  }, [dispatch, project.nodes]);

  const handleStartNode = useCallback((nodeId: string) => {
    dispatch({ type: 'START_NODE', nodeId });
    dispatch({ type: 'NAVIGATE', view: 'node-study' });
  }, [dispatch]);

  const handleGoToStudy = useCallback((nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', nodeId });
    dispatch({ type: 'NAVIGATE', view: 'node-study' });
  }, [dispatch]);

  const handleStartTest = useCallback(async (nodeId: string) => {
    const node = project.nodes[nodeId];
    if (!node) return;

    const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
    if (!activeCapstone) {
      setCommandError('캡스톤 정보가 없습니다.');
      return;
    }

    let testGoal = node.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;

    if (!testGoal) {
      dispatch({ type: 'SET_LLM_LOADING', operation: 'test_goal' });
      try {
        testGoal = await generateTestGoal(node, activeCapstone, state.selectedProvider);
        dispatch({ type: 'SET_TEST_GOAL', nodeId: node.id, testGoal });
      } catch (e) {
        setCommandError(e instanceof Error ? e.message : '테스트 목표 생성 실패');
        dispatch({ type: 'CLEAR_LLM_STATE' });
        return;
      }
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }

    const pastRecords = Object.values(project.testRecords).filter((r) => r.nodeId === nodeId);
    const lastRecord = pastRecords[pastRecords.length - 1];
    const difficulty = lastRecord?.summary.nextDifficulty === 'completed'
      ? '고급'
      : (lastRecord?.summary.nextDifficulty ?? testGoal.difficultyPolicy.initial) as '초급' | '중급' | '고급';

    dispatch({ type: 'SET_LLM_LOADING', operation: 'exam' });
    try {
      const { exam, answerKey } = await generateExam(testGoal, node, difficulty, state.selectedProvider, pastRecords);

      const type4 = exam.questions.filter((q) => q.type === 4);
      const others = exam.questions.filter((q) => q.type !== 4);

      dispatch({
        type: 'START_TEST_SESSION',
        exam: {
          exam: { ...exam, questions: [...type4, ...others] },
          answerKey,
          currentQuestionIndex: 0,
          answers: {},
          submittedQuestionIds: [],
        },
      });
    } catch (e) {
      setCommandError(e instanceof Error ? e.message : '시험 생성 실패');
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  }, [dispatch, project, state.selectedProvider]);

  const handleExcludeNode = useCallback((nodeId: string) => {
    dispatch({
      type: 'APPLY_GRAPH_PATCH',
      patch: {
        id: nanoid(),
        reason: `노드 제외: ${project.nodes[nodeId]?.name}`,
        operations: [{ type: 'exclude_node', nodeId }],
        expectedBaseVersion: project.graphVersion,
      },
    });
  }, [dispatch, project]);

  const handleRunCommand = async () => {
    if (!commandText.trim()) return;
    setCommandError('');
    setPatchErrors([]);
    dispatch({ type: 'SET_LLM_LOADING', operation: 'graph_patch' });
    try {
      const patch = await generateGraphPatch(project, commandText, state.selectedProvider);
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

  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
  const allReadyForCapstone = Object.values(project.nodes)
    .filter((n) => n.status !== 'excluded')
    .every((n) => n.status === 'completed');

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ←
          </button>
          <h1 className="font-semibold text-gray-100 text-sm truncate max-w-xs">{project.title}</h1>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">v{project.graphVersion}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            준비: {readyNodes.length} | 완료: {completedCount}/{totalCount}
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
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          {llm.isLoading && (
            <div className="absolute inset-0 z-10 bg-gray-950/70 flex items-center justify-center">
              <LoadingSpinner message={
                llm.operation === 'graph_patch' ? '그래프 패치 생성 중...' :
                llm.operation === 'exam' ? '시험 생성 중...' :
                '처리 중...'
              } />
            </div>
          )}
          <DagCanvas
            project={project}
            canvas={canvas}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
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
                onStartNode={handleStartNode}
                onStartTest={handleStartTest}
                onExcludeNode={handleExcludeNode}
                onGoToStudy={handleGoToStudy}
              />
            ) : (
              <div className="p-4 text-center text-gray-600 text-sm pt-10">
                노드를 클릭하면<br />상세 정보가 표시됩니다
              </div>
            )}
          </div>

          {/* Command Panel */}
          <div className="p-3 flex flex-col gap-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">그래프 수정</div>
            <textarea
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder="자연어로 그래프를 수정하세요...&#10;예: '파이썬 기초 노드를 변수, 함수, 클래스로 분리해줘'"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            {commandError && (
              <div className="text-xs text-red-400 bg-red-950 rounded p-2">{commandError}</div>
            )}

            {patchErrors.length > 0 && (
              <div className="text-xs text-orange-400 bg-orange-950 rounded p-2">
                {patchErrors.map((e, i) => <div key={i}>{e}</div>)}
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
