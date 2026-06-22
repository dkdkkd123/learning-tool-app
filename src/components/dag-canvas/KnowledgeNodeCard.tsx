import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { KnowledgeNode } from '../../domain/types';

type NodeData = {
  node: KnowledgeNode;
  isSelected: boolean;
  onDoubleClick: (nodeId: string) => void;
};

function statusStyle(status: KnowledgeNode['status']): string {
  switch (status) {
    case 'waiting': return 'border-gray-600 bg-gray-800';
    case 'studying': return 'border-yellow-400 bg-yellow-950 shadow-yellow-900';
    case 'completed': return 'border-emerald-500 bg-emerald-950 shadow-emerald-900';
    case 'excluded': return 'border-gray-700 bg-gray-900 opacity-30';
    default: return 'border-gray-600 bg-gray-800';
  }
}

function statusBadge(status: KnowledgeNode['status']) {
  switch (status) {
    case 'waiting': return null;
    case 'studying': return <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded-full">학습 중</span>;
    case 'completed': return <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"><span>✓</span> 완료</span>;
    case 'excluded': return <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">제외됨</span>;
    default: return null;
  }
}

function testGoalBadge(status: KnowledgeNode['testGoalStatus']) {
  if (status === 'stale') {
    return <span className="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded-full">오래됨</span>;
  }
  if (status === 'ready') {
    return <span className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded-full">테스트 준비</span>;
  }
  return null;
}

export function KnowledgeNodeCard({ data }: { data: NodeData }) {
  const { node, isSelected, onDoubleClick } = data;

  return (
    <div
      className={`
        w-52 rounded-xl border-2 p-3 cursor-pointer shadow-lg transition-all
        ${statusStyle(node.status)}
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900' : ''}
      `}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2" />

      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-sm font-semibold text-gray-100 leading-tight line-clamp-2">{node.name}</span>
        {statusBadge(node.status)}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 mb-1.5">{node.summary}</p>

      <div className="flex gap-1 flex-wrap">
        {testGoalBadge(node.testGoalStatus)}
      </div>
    </div>
  );
}
