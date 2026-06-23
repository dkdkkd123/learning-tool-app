import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { proposeCapstones } from '../services/llmGateway';
import { getModelConfig } from '../domain/types';

export function IntakeStep2Page() {
  const { state, dispatch } = useApp();
  const [content, setContent] = useState(state.project?.originalInput ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleNext() {
    if (!content.trim()) {
      setError('학습 내용을 입력해주세요.');
      return;
    }
    setError('');
    setIsLoading(true);

    // Create or update project with input
    if (!state.project) {
      const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      dispatch({
        type: 'CREATE_PROJECT',
        title,
        inputMode: 'learning_content',
        originalInput: content,
      });
    }

    try {
      const config = getModelConfig(state);
      const candidates = await proposeCapstones(content, 'learning_content', config);
      dispatch({ type: 'SET_CAPSTONE_CANDIDATES', candidates });
    } catch (e) {
      setError(e instanceof Error ? e.message : '캡스톤 제안 실패');
    } finally {
      setIsLoading(false);
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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-6 h-6 rounded-full bg-blue-900 text-blue-400 text-xs flex items-center justify-center">✓</span>
          <div className="h-px w-8 bg-blue-800" />
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
          <div className="h-px w-8 bg-gray-700" />
          <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-500 text-xs flex items-center justify-center">3</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-100 mb-2 text-center">무엇을 학습하고 싶으신가요?</h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          배우고 싶은 주제나 목표를 입력하면 AI가 적합한 캡스톤 과제를 제안합니다.
        </p>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 딥러닝의 기초 개념을 이해하고 간단한 신경망을 구현해보고 싶습니다..."
          rows={5}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm mb-4"
          autoFocus
        />

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'NAVIGATE', view: 'intake-step1' })}
            className="flex-1 justify-center"
          >
            뒤로
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            disabled={!content.trim()}
            className="flex-1 justify-center"
          >
            캡스톤 제안 받기
          </Button>
        </div>
      </div>
    </div>
  );
}
