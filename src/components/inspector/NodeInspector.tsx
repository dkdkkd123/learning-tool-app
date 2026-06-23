import React from 'react';
import type { KnowledgeNode, StudyProject } from '../../domain/types';
import { Button } from '../ui/Button';

type Props = {
  node: KnowledgeNode;
  project: StudyProject;
  onRequestTest: (nodeId: string) => void;
  onSetStatus: (nodeId: string, status: KnowledgeNode['status']) => void;
};

function statusLabel(status: KnowledgeNode['status']): string {
  switch (status) {
    case 'waiting': return '대기 중';
    case 'studying': return '학습 중';
    case 'completed': return '학습 완료';
    case 'excluded': return '제외됨';
    default: return status;
  }
}

const STATUS_OPTIONS: KnowledgeNode['status'][] = ['waiting', 'studying', 'completed'];

export function NodeInspector({ node, project, onRequestTest, onSetStatus }: Props) {
  const prerequisites = node.prerequisiteNodeIds
    .map((id) => project.nodes[id])
    .filter(Boolean);
  const successors = project.edges
    .filter((e) => e.from === node.id)
    .map((e) => project.nodes[e.to])
    .filter(Boolean);

  const testGoal = node.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;
  const testHistory = Object.values(project.testRecords)
    .filter((r) => r.nodeId === node.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const isPendingTest = project.pendingTests.some((t) => t.nodeId === node.id);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {/* Name + summary */}
      <div>
        <h3 className="font-semibold text-gray-100 text-sm leading-tight mb-1">{node.name}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{node.summary}</p>
      </div>

      {/* Status change */}
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">학습 상태</div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSetStatus(node.id, s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                node.status === s
                  ? s === 'completed'
                    ? 'bg-emerald-700 text-emerald-100'
                    : s === 'studying'
                    ? 'bg-yellow-700 text-yellow-100'
                    : 'bg-gray-600 text-gray-200'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      {prerequisites.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">선행 노드</div>
          <div className="flex flex-col gap-1">
            {prerequisites.map((pre) => (
              <div key={pre.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    pre.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-400 truncate">{pre.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Successors */}
      {successors.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">다음 노드</div>
          <div className="flex flex-col gap-1">
            {successors.map((suc) => (
              <div key={suc.id} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    suc.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-400 truncate">{suc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test goal info */}
      {testGoal && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">테스트 목표</div>
          <div className="bg-gray-800 rounded-lg p-2 text-xs text-gray-300">
            <div className="font-medium mb-0.5">{testGoal.topic}</div>
            <div className="text-gray-500">완료 기준: {testGoal.completionRule.requiredDifficulty} 합격</div>
          </div>
        </div>
      )}

      {/* Test history */}
      {testHistory.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">테스트 기록</div>
          <div className="flex flex-col gap-1">
            {testHistory.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{r.difficulty}</span>
                <span
                  className={
                    r.summary.overallVerdict === 'pass' ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {r.summary.overallVerdict === 'pass' ? '합격' : '불합격'}{' '}
                  {r.summary.passCount}/{r.summary.totalCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test request button */}
      <div className="pt-2 border-t border-gray-800">
        <Button
          size="sm"
          variant={isPendingTest ? 'ghost' : 'secondary'}
          onClick={() => !isPendingTest && onRequestTest(node.id)}
          disabled={isPendingTest}
          className="w-full justify-center"
        >
          {isPendingTest ? '테스트 신청됨 ✓' : '테스트 신청'}
        </Button>
      </div>
    </div>
  );
}
