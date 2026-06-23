import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { generateTestGoal, generateExam } from '../services/llmGateway';
import { getModelConfig } from '../domain/types';
import type { PendingTest } from '../domain/types';

export function TestQueuePage() {
  const { state, dispatch } = useApp();
  const { project } = state;

  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pendingTests = project?.pendingTests ?? [];

  async function handleStartTest(pending: PendingTest) {
    if (!project) return;
    const node = project.nodes[pending.nodeId];
    if (!node) {
      // Node was removed — remove stale pending test
      dispatch({ type: 'REMOVE_PENDING_TEST', pendingTestId: pending.id });
      return;
    }

    const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
    if (!activeCapstone) {
      setError('캡스톤 정보가 없습니다.');
      return;
    }

    setStartingId(pending.id);
    setError('');

    try {
      const config = getModelConfig(state);
      let testGoal = node.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;

      if (!testGoal) {
        testGoal = await generateTestGoal(node, activeCapstone, config);
        dispatch({ type: 'SET_TEST_GOAL', nodeId: node.id, testGoal });
      }

      const pastRecords = Object.values(project.testRecords).filter((r) => r.nodeId === pending.nodeId);
      const lastRecord = pastRecords[pastRecords.length - 1];
      const difficulty =
        lastRecord?.summary.nextDifficulty === 'completed'
          ? '고급'
          : ((lastRecord?.summary.nextDifficulty ?? testGoal.difficultyPolicy.initial) as '초급' | '중급' | '고급');

      const { exam, answerKey } = await generateExam(testGoal, node, difficulty, config, pastRecords);

      const type4 = exam.questions.filter((q) => q.type === 4);
      const others = exam.questions.filter((q) => q.type !== 4);

      // Remove from queue before starting
      dispatch({ type: 'REMOVE_PENDING_TEST', pendingTestId: pending.id });

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
      setError(e instanceof Error ? e.message : '테스트 시작 실패');
    } finally {
      setStartingId(null);
    }
  }

  function handleRemove(pendingTestId: string) {
    dispatch({ type: 'REMOVE_PENDING_TEST', pendingTestId });
  }

  if (startingId) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" message="테스트를 생성하는 중..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-xl font-bold text-gray-100 mb-2">테스트 대기열</h1>
        <p className="text-sm text-gray-500 mb-8">
          DAG 워크스페이스에서 신청한 테스트 목록입니다.
        </p>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-sm text-red-300">
            {error}
          </div>
        )}

        {pendingTests.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <div className="text-4xl mb-3">✎</div>
            <div className="text-sm">신청된 테스트가 없습니다.</div>
            <div className="text-xs text-gray-700 mt-1">
              DAG 워크스페이스에서 노드를 우클릭하여 테스트를 신청하세요.
            </div>
            {project && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'NAVIGATE', view: 'dag-workspace' })}
                className="mt-4"
              >
                DAG 워크스페이스로
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingTests.map((pending) => {
              const node = project?.nodes[pending.nodeId];
              const testHistory = project
                ? Object.values(project.testRecords).filter((r) => r.nodeId === pending.nodeId)
                : [];
              const lastRecord = testHistory[testHistory.length - 1];

              return (
                <div
                  key={pending.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-medium text-gray-100 text-sm">{pending.nodeName}</div>
                      {node && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{node.summary}</div>
                      )}
                      {!node && (
                        <div className="text-xs text-red-400 mt-0.5">노드가 제거되었습니다</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 flex-shrink-0">
                      {new Date(pending.requestedAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {lastRecord && (
                    <div className="text-xs text-gray-500 mb-3">
                      마지막 시험: {lastRecord.difficulty}{' '}
                      <span className={lastRecord.summary.overallVerdict === 'pass' ? 'text-emerald-400' : 'text-red-400'}>
                        {lastRecord.summary.overallVerdict === 'pass' ? '합격' : '불합격'}
                      </span>
                      {' '}→ 다음: {lastRecord.summary.nextDifficulty === 'completed' ? '완료' : lastRecord.summary.nextDifficulty}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleStartTest(pending)}
                      disabled={!node}
                      className="flex-1 justify-center"
                    >
                      테스트 시작
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(pending.id)}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
