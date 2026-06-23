import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { CapstoneNode } from '../../domain/types';

type NodeData = {
  node: CapstoneNode;
};

function statusStyle(status: CapstoneNode['status']): string {
  switch (status) {
    case 'waiting': return 'border-purple-600 bg-purple-950';
    case 'ready': return 'border-purple-400 bg-purple-900 shadow-purple-800';
    case 'attempting': return 'border-yellow-400 bg-yellow-950';
    case 'achieved': return 'border-emerald-400 bg-emerald-950';
    case 'failed': return 'border-red-500 bg-red-950';
    default: return 'border-purple-600 bg-purple-950';
  }
}

export function CapstoneNodeCard({ data, selected }: { data: NodeData; selected?: boolean }) {
  const { node } = data;

  return (
    <div
      className={`
        w-56 rounded-xl border-2 p-3 shadow-lg
        ${statusStyle(node.status)}
        ${selected ? 'ring-2 ring-purple-300 ring-offset-1 ring-offset-gray-900' : ''}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-300 text-lg">◆</span>
        <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">캡스톤</span>
      </div>

      <div className="text-sm font-semibold text-purple-100 leading-tight mb-1 line-clamp-2">
        {node.title}
      </div>

      <p className="text-xs text-purple-300 leading-relaxed line-clamp-2 mb-1.5">{node.description}</p>

      <div className="text-xs text-purple-400 italic line-clamp-1">{node.successCriteria}</div>

      {node.status === 'achieved' && (
        <div className="mt-2 flex items-center gap-1 text-emerald-300 text-xs font-medium">
          <span>✓</span><span>달성!</span>
        </div>
      )}
    </div>
  );
}
