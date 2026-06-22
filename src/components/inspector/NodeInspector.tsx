import React from 'react';
import type { KnowledgeNode, StudyProject } from '../../domain/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type Props = {
  node: KnowledgeNode;
  project: StudyProject;
  onStartNode: (nodeId: string) => void;
  onStartTest: (nodeId: string) => void;
  onExcludeNode: (nodeId: string) => void;
  onGoToStudy: (nodeId: string) => void;
};

function statusColor(status: KnowledgeNode['status']): 'gray' | 'yellow' | 'green' | 'blue' {
  switch (status) {
    case 'waiting': return 'gray';
    case 'studying': return 'yellow';
    case 'completed': return 'green';
    case 'excluded': return 'gray';
    default: return 'gray';
  }
}

function statusLabel(status: KnowledgeNode['status']): string {
  switch (status) {
    case 'waiting': return '대기 중';
    case 'studying': return '학습 중';
    case 'completed': return '완료';
    case 'excluded': return '제외됨';
    default: return status;
  }
}

export function NodeInspector({ node, project, onStartNode, onStartTest, onExcludeNode, onGoToStudy }: Props) {
  const prerequisites = node.prerequisiteNodeIds.map((id) => project.nodes[id]).filter(Boolean);
  const successors = project.edges
    .filter((e) => e.from === node.id)
    .map((e) => project.nodes[e.to])
    .filter(Boolean);

  const testGoal = node.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;

  const isReady = node.status === 'waiting' && prerequisites.every(
    (p) => p.status === 'completed' || p.status === 'excluded'
  );

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-100 text-sm leading-tight">{node.name}</h3>
          <Badge color={statusColor(node.status)}>{statusLabel(node.status)}</Badge>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{node.summary}</p>
      </div>

      {prerequisites.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">선행 노드</div>
          <div className="flex flex-col gap-1">
            {prerequisites.map((pre) => (
              <div key={pre.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pre.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className="text-xs text-gray-300 truncate">{pre.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {successors.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">다음 노드</div>
          <div className="flex flex-col gap-1">
            {successors.map((suc) => (
              <div key={suc.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${suc.status === 'completed' ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className="text-xs text-gray-300 truncate">{suc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {testGoal && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">테스트 목표</div>
          <div className="bg-gray-800 rounded-lg p-2 text-xs text-gray-300">
            <div className="font-medium mb-0.5">{testGoal.topic}</div>
            <div className="text-gray-400">{testGoal.targetDescription}</div>
            <div className="text-gray-500 mt-1">완료 기준: {testGoal.completionRule.requiredDifficulty} 합격</div>
          </div>
        </div>
      )}

      {node.notes.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">노트</div>
          <div className="text-xs text-gray-400">{node.notes[node.notes.length - 1].slice(0, 120)}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-800">
        <Button size="sm" variant="secondary" onClick={() => onGoToStudy(node.id)} className="w-full justify-center">
          학습 페이지
        </Button>
        {(node.status === 'waiting' || node.status === 'studying') && (
          <Button
            size="sm"
            variant={isReady ? 'primary' : 'ghost'}
            onClick={() => onStartNode(node.id)}
            className="w-full justify-center"
            disabled={!isReady && node.status === 'waiting'}
          >
            {node.status === 'studying' ? '계속 학습' : '공부 시작'}
          </Button>
        )}
        {(node.status === 'studying' || node.status === 'completed') && (
          <Button size="sm" variant="success" onClick={() => onStartTest(node.id)} className="w-full justify-center">
            테스트 시작
          </Button>
        )}
        {node.status !== 'excluded' && node.status !== 'completed' && (
          <Button size="sm" variant="ghost" onClick={() => onExcludeNode(node.id)} className="w-full justify-center text-gray-500">
            제외
          </Button>
        )}
      </div>
    </div>
  );
}
