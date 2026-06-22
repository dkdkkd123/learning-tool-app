import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import type { CapstoneCandidate, CapstoneNode } from '../domain/types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { proposeCapstones, generateDagDraft } from '../services/llmGateway';

const outputTypeLabels: Record<string, string> = {
  problem_solution: '문제 풀이',
  project: '프로젝트',
  analysis: '분석',
  implementation: '구현',
  proof: '증명',
  other: '기타',
};

export function CapstoneReviewPage() {
  const { state, dispatch } = useApp();
  const candidates = state.capstoneCandidates ?? [];
  const project = state.project;

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CapstoneCandidate>>({});
  const [error, setError] = useState('');

  const isLoading = state.llm.isLoading;
  const operation = state.llm.operation;

  async function handleSelect(candidate: CapstoneCandidate) {
    if (!project) return;
    setError('');

    const capstone: CapstoneNode = {
      id: nanoid(),
      kind: 'capstone',
      title: candidate.title,
      description: candidate.description,
      successCriteria: candidate.successCriteria,
      outputType: candidate.outputType,
      prerequisiteNodeIds: [],
      status: 'waiting',
      attemptLogs: [],
    };

    dispatch({ type: 'CONFIRM_CAPSTONE', capstone });
    dispatch({ type: 'SET_LLM_LOADING', operation: 'dag_draft' });

    try {
      const { nodes, edges } = await generateDagDraft(capstone, state.selectedProvider);
      dispatch({ type: 'SET_DAG_DRAFT', nodes, edges });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'DAG 생성에 실패했습니다.');
      dispatch({ type: 'SET_LLM_ERROR', error: String(e) });
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  }

  async function handleRepropose() {
    if (!project) return;
    setError('');
    dispatch({ type: 'SET_LLM_LOADING', operation: 'capstone' });
    try {
      const newCandidates = await proposeCapstones(project.originalInput, project.inputMode, state.selectedProvider);
      dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates: newCandidates });
    } catch (e) {
      setError(String(e));
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  }

  function handleEdit(idx: number) {
    setEditingIdx(idx);
    setEditDraft({ ...candidates[idx] });
  }

  function handleSaveEdit(idx: number) {
    const updated = candidates.map((c, i) => (i === idx ? { ...c, ...editDraft } as CapstoneCandidate : c));
    dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates: updated });
    setEditingIdx(null);
  }

  if (isLoading && operation === 'dag_draft') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="지식 그래프(DAG)를 생성하는 중..." />
      </div>
    );
  }

  if (isLoading && operation === 'capstone') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="새 캡스톤을 제안하는 중..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'intake' })}
          className="text-gray-500 hover:text-gray-300 text-sm mb-6 flex items-center gap-1"
        >
          ← 뒤로
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">캡스톤 과제 선택</h1>
            <p className="text-gray-400 text-sm mt-1">달성하고 싶은 최종 목표를 선택하세요</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRepropose}>
            다시 제안
          </Button>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {candidates.map((candidate, idx) => (
            <div
              key={idx}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              {editingIdx === idx ? (
                <div className="flex flex-col gap-3">
                  <input
                    value={editDraft.title ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="제목"
                  />
                  <textarea
                    value={editDraft.description ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    rows={3}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="설명"
                  />
                  <input
                    value={editDraft.successCriteria ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, successCriteria: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="성공 기준"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleSaveEdit(idx)}>저장</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>취소</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-gray-100 text-base">{candidate.title}</h3>
                    <Badge color="blue">{outputTypeLabels[candidate.outputType] ?? candidate.outputType}</Badge>
                  </div>

                  <p className="text-sm text-gray-300 leading-relaxed mb-3">{candidate.description}</p>

                  <div className="bg-gray-800 rounded-lg p-3 mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">성공 기준</div>
                    <p className="text-sm text-gray-200">{candidate.successCriteria}</p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">왜 핵심 과제인가?</div>
                    <p className="text-sm text-gray-400">{candidate.whyCanonical}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleSelect(candidate)} className="flex-1 justify-center">
                      선택
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(idx)}>
                      수정
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
