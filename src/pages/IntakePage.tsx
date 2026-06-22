import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { proposeCapstones } from '../services/llmGateway';

export function IntakePage() {
  const { state, dispatch } = useApp();

  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'learning_content' | 'capstone'>('learning_content');
  const [outputType, setOutputType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [knownKnowledge, setKnownKnowledge] = useState('');
  const [excludedScope, setExcludedScope] = useState('');
  const [error, setError] = useState('');

  const isLoading = state.llm.isLoading && state.llm.operation === 'capstone';

  async function handleSubmit() {
    if (!input.trim()) {
      setError('학습 내용을 입력해주세요.');
      return;
    }
    setError('');

    const title = input.slice(0, 60) + (input.length > 60 ? '...' : '');

    // Create project
    dispatch({ type: 'CREATE_PROJECT', title, inputMode, originalInput: input });
    dispatch({ type: 'SET_LLM_LOADING', operation: 'capstone' });

    try {
      const candidates = await proposeCapstones(input, inputMode, state.selectedProvider, {
        outputType: outputType || undefined,
        difficulty: difficulty || undefined,
        knownKnowledge: knownKnowledge || undefined,
        excludedScope: excludedScope || undefined,
      });
      dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates });
    } catch (e: unknown) {
      dispatch({ type: 'SET_LLM_ERROR', error: e instanceof Error ? e.message : '캡스톤 제안 실패' });
      setError(e instanceof Error ? e.message : '캡스톤 제안에 실패했습니다.');
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="캡스톤 과제를 생성하는 중..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}
          className="text-gray-500 hover:text-gray-300 text-sm mb-6 flex items-center gap-1"
        >
          ← 홈으로
        </button>

        <h1 className="text-2xl font-bold mb-8">새 학습 프로젝트</h1>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setInputMode('learning_content')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'learning_content'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            학습 내용
          </button>
          <button
            onClick={() => setInputMode('capstone')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              inputMode === 'capstone'
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            캡스톤 문제
          </button>
        </div>

        {/* Main input */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            {inputMode === 'learning_content'
              ? '어떤 것을 배우고 싶으신가요?'
              : '어떤 캡스톤 과제를 달성하고 싶으신가요?'}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              inputMode === 'learning_content'
                ? '예: 딥러닝의 기초, React로 풀스택 앱 만들기, 알고리즘 문제 풀이...'
                : '예: 간단한 신경망을 직접 구현해보기, REST API 서버 만들기...'
            }
            rows={5}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          />
        </div>

        {/* Optional preferences */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">과제 유형 (선택)</label>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모두</option>
              <option value="problem_solution">문제 풀이</option>
              <option value="project">프로젝트</option>
              <option value="analysis">분석</option>
              <option value="implementation">구현</option>
              <option value="proof">증명</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">목표 난이도 (선택)</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">미지정</option>
              <option value="초급">초급</option>
              <option value="중급">중급</option>
              <option value="고급">고급</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">이미 알고 있는 내용 (선택)</label>
            <input
              type="text"
              value={knownKnowledge}
              onChange={(e) => setKnownKnowledge(e.target.value)}
              placeholder="예: Python 기본 문법, HTML/CSS..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">제외할 범위 (선택)</label>
            <input
              type="text"
              value={excludedScope}
              onChange={(e) => setExcludedScope(e.target.value)}
              placeholder="예: 수학적 증명, 고급 이론..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          className="w-full justify-center"
          disabled={!input.trim()}
        >
          캡스톤 과제 제안 받기
        </Button>
      </div>
    </div>
  );
}
