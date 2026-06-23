import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { singleCall } from '../services/llmGateway';
import { getModelConfig } from '../domain/types';

export function CapstoneAttemptPage() {
  const { state, dispatch } = useApp();
  const { project } = state;

  const [submittedOutput, setSubmittedOutput] = useState('');
  const [selfJudgment, setSelfJudgment] = useState('');
  const [result, setResult] = useState<'achieved' | 'failed' | null>(null);
  const [llmSuggestion, setLlmSuggestion] = useState('');
  const [isRequestingJudge, setIsRequestingJudge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!project) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">프로젝트 없음</div>;
  }

  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);
  if (!activeCapstone) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">캡스톤 없음</div>;
  }

  async function handleRequestLLMJudge() {
    if (!submittedOutput.trim()) return;
    setIsRequestingJudge(true);
    try {
      const systemPrompt = 'JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.';
      const userPrompt = `캡스톤 과제: ${activeCapstone!.title}\n성공 기준: ${activeCapstone!.successCriteria}\n\n제출물:\n${submittedOutput}\n\n위 제출물이 성공 기준을 충족하는지 판단하고 JSON으로 반환하세요.\n{"verdict": "achieved|failed", "reasoning": "판단 근거", "suggestions": ["개선점1", "개선점2"]}`;
      const text = await singleCall(systemPrompt, userPrompt, getModelConfig(state));
      try {
        const parsed = JSON.parse(text) as { verdict: string; reasoning: string; suggestions: string[] };
        setLlmSuggestion(
          `판정: ${parsed.verdict === 'achieved' ? '달성' : '미달성'}\n\n근거: ${parsed.reasoning}\n\n제안:\n${parsed.suggestions?.join('\n') ?? ''}`
        );
        if (parsed.verdict === 'achieved' || parsed.verdict === 'failed') {
          setResult(parsed.verdict as 'achieved' | 'failed');
        }
      } catch {
        setLlmSuggestion(text);
      }
    } catch (e) {
      setLlmSuggestion(`오류: ${String(e)}`);
    } finally {
      setIsRequestingJudge(false);
    }
  }

  function handleFinalSubmit() {
    if (!result) return;
    setIsSubmitting(true);

    const log = {
      id: nanoid(),
      result,
      submittedOutput,
      judgementNote: selfJudgment,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'COMPLETE_CAPSTONE', log, result });
    dispatch({ type: 'NAVIGATE', view: 'achievement-log' });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'dag-workspace' })}
          className="text-gray-500 hover:text-gray-300 text-sm mb-6 flex items-center gap-1"
        >
          ← 워크스페이스
        </button>

        {/* Capstone info */}
        <div className="bg-purple-950 border border-purple-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-purple-300 text-lg">◆</span>
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">캡스톤 도전</span>
          </div>
          <h1 className="text-xl font-bold text-purple-100 mb-2">{activeCapstone.title}</h1>
          <p className="text-sm text-purple-300 mb-3">{activeCapstone.description}</p>
          <div className="bg-purple-900/50 rounded-lg p-3">
            <div className="text-xs font-medium text-purple-400 mb-1">성공 기준</div>
            <p className="text-sm text-purple-200">{activeCapstone.successCriteria}</p>
          </div>
        </div>

        {/* Submitted output */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">제출물 설명</label>
          <textarea
            value={submittedOutput}
            onChange={(e) => setSubmittedOutput(e.target.value)}
            placeholder="캡스톤 과제의 결과물을 설명해주세요. 구현 내용, 해결 방법, 분석 결과 등을 상세히 기술하세요..."
            rows={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
          />
        </div>

        {/* Self judgment memo */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">자기 판정 메모</label>
          <textarea
            value={selfJudgment}
            onChange={(e) => setSelfJudgment(e.target.value)}
            placeholder="성공 기준과 비교한 자기 평가를 작성해주세요..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
          />
        </div>

        {/* LLM judge */}
        <div className="mb-6">
          <Button
            variant="secondary"
            onClick={handleRequestLLMJudge}
            loading={isRequestingJudge}
            disabled={!submittedOutput.trim()}
            className="w-full justify-center"
          >
            LLM 판정 보조 요청
          </Button>
          {llmSuggestion && (
            <div className="mt-3 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">LLM 판정 보조</div>
              {llmSuggestion}
            </div>
          )}
        </div>

        {/* Result selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">최종 판정</label>
          <div className="flex gap-3">
            <button
              onClick={() => setResult('achieved')}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                result === 'achieved'
                  ? 'border-emerald-500 bg-emerald-950 text-emerald-200'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-emerald-700'
              }`}
            >
              달성
            </button>
            <button
              onClick={() => setResult('failed')}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                result === 'failed'
                  ? 'border-red-500 bg-red-950 text-red-200'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-red-700'
              }`}
            >
              미달성
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={handleFinalSubmit}
          disabled={!result || !submittedOutput.trim()}
          loading={isSubmitting}
          className="w-full justify-center"
        >
          최종 제출
        </Button>
      </div>
    </div>
  );
}
