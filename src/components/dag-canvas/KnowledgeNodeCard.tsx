import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { KnowledgeNode } from '../../domain/types';

type NodeData = {
  node: KnowledgeNode;
  previewHighlight?: 'added' | 'removed';
};

function statusStyle(status: KnowledgeNode['status'], highlight?: 'added' | 'removed'): string {
  if (highlight === 'added') return 'border-emerald-400 bg-emerald-950 shadow-emerald-900 shadow-lg';
  if (highlight === 'removed') return 'border-red-500 bg-red-950 opacity-60';
  switch (status) {
    case 'waiting': return 'border-gray-600 bg-gray-800';
    case 'studying': return 'border-yellow-400 bg-yellow-950 shadow-yellow-900';
    case 'completed': return 'border-emerald-500 bg-emerald-950 shadow-emerald-900';
    case 'excluded': return 'border-gray-700 bg-gray-900 opacity-30';
    default: return 'border-gray-600 bg-gray-800';
  }
}

function statusBadge(status: KnowledgeNode['status'], highlight?: 'added' | 'removed') {
  if (highlight === 'added') {
    return <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full">+ 추가</span>;
  }
  if (highlight === 'removed') {
    return <span className="text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded-full">- 제거</span>;
  }
  switch (status) {
    case 'waiting': return null;
    case 'studying': return <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded-full">학습 중</span>;
    case 'completed': return <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"><span>✓</span> 완료</span>;
    case 'excluded': return <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">제외됨</span>;
    default: return null;
  }
}

export function KnowledgeNodeCard({ data, selected }: { data: NodeData; selected?: boolean }) {
  const { node, previewHighlight } = data;

  return (
    <div
      className={`
        w-52 rounded-xl border-2 p-3 cursor-pointer shadow-lg transition-all
        ${statusStyle(node.status, previewHighlight)}
        ${selected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900' : ''}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2" />

      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-sm font-semibold text-gray-100 leading-tight line-clamp-2">{node.name}</span>
        {statusBadge(node.status, previewHighlight)}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{node.summary}</p>
    </div>
  );
}
