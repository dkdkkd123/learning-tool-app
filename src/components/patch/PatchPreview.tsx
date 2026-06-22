import React from 'react';
import type { GraphPatch } from '../../domain/types';
import { Button } from '../ui/Button';

type Props = {
  patch: GraphPatch;
  onApply: () => void;
  onDiscard: () => void;
  isApplying?: boolean;
};

function operationLabel(type: string): string {
  const labels: Record<string, string> = {
    add_node: '노드 추가',
    update_node: '노드 수정',
    remove_node: '노드 삭제',
    exclude_node: '노드 제외',
    add_edge: '엣지 추가',
    remove_edge: '엣지 제거',
    split_node: '노드 분리',
    merge_nodes: '노드 병합',
    replace_subgraph: '부분 그래프 교체',
  };
  return labels[type] ?? type;
}

export function PatchPreview({ patch, onApply, onDiscard, isApplying }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-yellow-400 text-sm">패치 미리보기</span>
        <span className="text-xs text-gray-500">v{patch.expectedBaseVersion} → v{patch.expectedBaseVersion + 1}</span>
      </div>

      <div className="text-xs text-gray-300 mb-3 bg-gray-900 rounded-lg p-2">
        <span className="text-gray-500 mr-1">이유:</span>
        {patch.reason}
      </div>

      <div className="flex flex-col gap-1 mb-4">
        <div className="text-xs text-gray-500 mb-1">작업 목록 ({patch.operations.length}개)</div>
        {patch.operations.map((op, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={`
              px-1.5 py-0.5 rounded text-xs font-medium
              ${op.type.startsWith('add') ? 'bg-emerald-900 text-emerald-300' :
                op.type.startsWith('remove') || op.type === 'exclude_node' ? 'bg-red-900 text-red-300' :
                'bg-blue-900 text-blue-300'}
            `}>
              {operationLabel(op.type)}
            </span>
            <span className="text-gray-400 truncate">
              {'nodeId' in op ? op.nodeId :
               'node' in op ? op.node.name :
               'edge' in op ? `${op.edge.from} → ${op.edge.to}` :
               'targetNodeId' in op ? op.targetNodeId :
               'sourceNodeIds' in op ? op.sourceNodeIds.join(', ') :
               ''}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={onApply} loading={isApplying} className="flex-1 justify-center">
          적용
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard} className="flex-1 justify-center">
          폐기
        </Button>
      </div>
    </div>
  );
}
