import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge as FlowEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StudyProject, CanvasState } from '../../domain/types';
import { KnowledgeNodeCard } from './KnowledgeNodeCard';
import { CapstoneNodeCard } from './CapstoneNodeCard';
import { useApp } from '../../context/AppContext';

const nodeTypes = {
  knowledge: KnowledgeNodeCard,
  capstone: CapstoneNodeCard,
};

type Props = {
  project: StudyProject;
  canvas: CanvasState;
  onNodeClick: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
};

export function DagCanvas({ project, canvas, onNodeClick, onNodeDoubleClick }: Props) {
  const { dispatch } = useApp();

  const flowNodes = useMemo<Node[]>(() => {
    const result: Node[] = [];

    // Knowledge nodes
    for (const [id, node] of Object.entries(project.nodes)) {
      const pos = canvas.nodePositions[id] ?? { x: 0, y: 0 };
      result.push({
        id,
        type: 'knowledge',
        position: pos,
        data: {
          node,
          isSelected: canvas.selectedIds.includes(id),
          onDoubleClick: onNodeDoubleClick,
        },
        draggable: true,
      });
    }

    // Capstone nodes
    for (const capstone of project.capstones) {
      const pos = canvas.nodePositions[capstone.id] ?? { x: 800, y: 300 };
      result.push({
        id: capstone.id,
        type: 'capstone',
        position: pos,
        data: {
          node: capstone,
          isSelected: canvas.selectedIds.includes(capstone.id),
        },
        draggable: true,
      });
    }

    return result;
  }, [project, canvas, onNodeDoubleClick]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    return project.edges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      style: { stroke: '#4b5563', strokeWidth: 2 },
      animated: false,
    }));
  }, [project.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync when project changes
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Track position changes
      const posUpdates: Record<string, { x: number; y: number }> = {};
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          posUpdates[change.id] = change.position;
        }
      }
      if (Object.keys(posUpdates).length > 0) {
        dispatch({
          type: 'UPDATE_CANVAS_STATE',
          canvas: {
            nodePositions: { ...canvas.nodePositions, ...posUpdates },
            layoutMode: 'manual',
          },
        });
      }
    },
    [onNodesChange, dispatch, canvas.nodePositions]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeDoubleClick(node.id);
    },
    [onNodeDoubleClick]
  );

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      dispatch({
        type: 'UPDATE_CANVAS_STATE',
        canvas: { viewport },
      });
    },
    [dispatch]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onMoveEnd={handleMoveEnd}
      defaultViewport={canvas.viewport}
      fitView={canvas.viewport.x === 0 && canvas.viewport.y === 0}
      minZoom={0.2}
      maxZoom={2}
      className="bg-gray-950"
    >
      <Background color="#374151" gap={20} variant={BackgroundVariant.Dots} />
      <Controls className="!bg-gray-800 !border-gray-700" />
      <MiniMap
        className="!bg-gray-900 !border-gray-700"
        nodeColor={(n) => {
          const data = n.data as { node?: { status?: string } };
          const status = data?.node?.status;
          if (status === 'completed') return '#059669';
          if (status === 'studying') return '#ca8a04';
          if (n.type === 'capstone') return '#7c3aed';
          return '#374151';
        }}
      />
    </ReactFlow>
  );
}
