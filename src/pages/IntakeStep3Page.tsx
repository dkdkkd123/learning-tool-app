import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import type { CapstoneCandidate, CapstoneNode } from '../domain/types';
import { getModelConfig } from '../domain/types';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { proposeCapstones, generateDagDraft } from '../services/llmGateway';

export function IntakeStep3Page() {
  const { state, dispatch } = useApp();
  const candidates = state.capstoneCandidates ?? [];
  const project = state.project;

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CapstoneCandidate>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReproposing, setIsReproposing] = useState(false);
  const [error, setError] = useState('');

  async function handleSelect(candidate: CapstoneCandidate) {
    if (!project) return;
    setError('');
    setIsGenerating(true);

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

    try {
      const config = getModelConfig(state);
      const { nodes, edges } = await generateDagDraft(capstone, config);
      dispatch({ type: 'SET_DAG_DRAFT', nodes, edges });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DAG 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRepropose() {
    if (!project) return;
    setError('');
    setIsReproposing(true);
    try {
      const config = getModelConfig(state);
      const newCandidates = await proposeCapstones(
        project.originalInput,
        project.inputMode,
        config
      );
      dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates: newCandidates });
    } catch (e) {
      setError(String(e));
    } finally {
      setIsReproposing(false);
    }
  }

  function handleEdit(idx: number) {
    setEditingIdx(idx);
    setEditDraft({ ...candidates[idx] });
  }

  function handleSaveEdit(idx: number) {
    const updated = candidates.map((c, i) =>
      i === idx ? ({ ...c, ...editDraft } as CapstoneCandidate) : c
    );
    dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates: updated });
    setEditingIdx(null);
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="지식 그래프(DAG)를 생성하는 중..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-6 h-6 rounded-full bg-blue-900 text-blue-400 text-xs flex items-center justify-center">✓</span>
          <div className="h-px w-8 bg-blue-800" />
          <span className="w-6 h-6 rounded-full bg-blue-900 text-blue-400 text-xs flex items-center justify-center">✓</span>
          <div className="h-px w-8 bg-blue-800" />
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">캡스톤 과제 선택</h1>
            <p className="text-gray-400 text-sm mt-1">달성하고 싶은 최종 목표를 선택하거나 수정하세요</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRepropose}
            loading={isReproposing}
            disabled={isReproposing}
          >
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
            <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {editingIdx === idx ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">제목</label>
                    <input
                      value={editDraft.title ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">개요</label>
                    <textarea
                      value={editDraft.description ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">성공 기준</label>
                    <textarea
                      value={editDraft.successCriteria ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, successCriteria: e.target.value }))}
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleSaveEdit(idx)}>
                      저장
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-100 text-base mb-2">{candidate.title}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">{candidate.description}</p>
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      성공 기준
                    </div>
                    <p className="text-sm text-gray-200">{candidate.successCriteria}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSelect(candidate)}
                      className="flex-1 justify-center"
                    >
                      이 캡스톤으로 시작
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

        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'intake-step2' })}
          className="mt-6 w-full justify-center"
        >
          ← 이전으로
        </Button>
      </div>
    </div>
  );
}
