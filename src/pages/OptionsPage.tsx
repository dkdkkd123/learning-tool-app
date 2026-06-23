import React from 'react';
import { useApp } from '../context/AppContext';
import { OPENAI_MODEL_SPECS, ANTHROPIC_MODEL_SPECS } from '../domain/types';

export function OptionsPage() {
  const { state, dispatch } = useApp();

  const anthropicKeySet = !!import.meta.env.VITE_ANTHROPIC_API_KEY;
  const openaiKeySet = !!import.meta.env.VITE_OPENAI_API_KEY;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="text-xl font-bold text-gray-100 mb-8">설정</h1>

        {/* Provider */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">AI 제공자</h2>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_PROVIDER', provider: 'openai' })}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors border ${
                state.selectedProvider === 'openai'
                  ? 'bg-emerald-800 border-emerald-600 text-emerald-100'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              OpenAI
              <div className={`text-xs mt-0.5 ${openaiKeySet ? 'text-emerald-400' : 'text-red-400'}`}>
                {openaiKeySet ? '키 설정됨' : '키 없음'}
              </div>
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_PROVIDER', provider: 'anthropic' })}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors border ${
                state.selectedProvider === 'anthropic'
                  ? 'bg-purple-800 border-purple-600 text-purple-100'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Anthropic
              <div className={`text-xs mt-0.5 ${anthropicKeySet ? 'text-purple-400' : 'text-red-400'}`}>
                {anthropicKeySet ? '키 설정됨' : '키 없음'}
              </div>
            </button>
          </div>
        </section>

        {/* OpenAI model selector */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">OpenAI 모델</h2>
          <div className="flex flex-col gap-2">
            {OPENAI_MODEL_SPECS.map((spec) => {
              const isSelected = state.selectedModels.openai === spec.modelId;
              return (
                <button
                  key={spec.modelId}
                  onClick={() => dispatch({ type: 'SET_MODEL', provider: 'openai', modelId: spec.modelId })}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? 'bg-emerald-900 border-emerald-700 text-emerald-100'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{spec.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{spec.modelId}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Anthropic model selector */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Anthropic 모델</h2>
          <div className="flex flex-col gap-2">
            {ANTHROPIC_MODEL_SPECS.map((spec) => {
              const isSelected = state.selectedModels.anthropic === spec.modelId;
              return (
                <button
                  key={spec.modelId}
                  onClick={() => dispatch({ type: 'SET_MODEL', provider: 'anthropic', modelId: spec.modelId })}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    isSelected
                      ? 'bg-purple-900 border-purple-700 text-purple-100'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{spec.label}</span>
                    <span className="text-xs text-gray-500 font-mono">{spec.modelId}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* API keys info */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">API 키 설정</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            API 키는 프로젝트 루트의{' '}
            <code className="bg-gray-800 px-1 rounded text-gray-300">.env.local</code> 파일에 설정합니다.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <code className="text-xs text-gray-400">VITE_OPENAI_API_KEY</code>
              <span className={`text-xs font-medium ${openaiKeySet ? 'text-emerald-400' : 'text-red-400'}`}>
                {openaiKeySet ? '설정됨' : '미설정'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <code className="text-xs text-gray-400">VITE_ANTHROPIC_API_KEY</code>
              <span className={`text-xs font-medium ${anthropicKeySet ? 'text-emerald-400' : 'text-red-400'}`}>
                {anthropicKeySet ? '설정됨' : '미설정'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
