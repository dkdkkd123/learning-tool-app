import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';

export function IntakeStep1Page() {
  const { state, dispatch } = useApp();
  const [hasCapstone, setHasCapstone] = useState<boolean | null>(null);
  const [capstoneText, setCapstoneText] = useState('');

  function handleNo() {
    // No capstone → go to step 2 (learning content input)
    dispatch({ type: 'NAVIGATE', view: 'intake-step2' });
  }

  function handleYes() {
    setHasCapstone(true);
  }

  function handleNext() {
    if (!capstoneText.trim()) return;
    // User entered their own capstone text → treat as capstone mode, skip step 2
    // Go straight to step 3 with capstone text treated as content
    // We update the project's originalInput with the capstone text and navigate to step 3 (which will propose based on it)
    if (state.project) {
      // Update the project input
      dispatch({
        type: 'NAVIGATE',
        view: 'intake-step3',
      });
    }
    // Store capstone text in the project's originalInput
    dispatch({ type: 'NAVIGATE', view: 'intake-step3' });
    // We pass the text via a separate mechanism — store in capstoneCandidates as a single "user-provided" candidate
    // The step 3 page will show it for review
    dispatch({
      type: 'SET_CAPSTONE_CANDIDATES',
      candidates: [
        {
          title: capstoneText.slice(0, 60) || '캡스톤 과제',
          description: capstoneText,
          successCriteria: '',
          outputType: 'other',
          whyCanonical: '사용자 직접 입력',
        },
      ],
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
          <div className="h-px w-8 bg-gray-700" />
          <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-500 text-xs flex items-center justify-center">2</span>
          <div className="h-px w-8 bg-gray-700" />
          <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-500 text-xs flex items-center justify-center">3</span>
        </div>

        {hasCapstone === null ? (
          <>
            <h1 className="text-2xl font-bold text-gray-100 mb-2 text-center">캡스톤 과제가 있으신가요?</h1>
            <p className="text-gray-400 text-center text-sm mb-10">
              달성하고 싶은 구체적인 프로젝트나 문제가 있다면 직접 입력하세요.<br />
              없다면, 학습 내용을 입력하면 AI가 캡스톤을 제안해 드립니다.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleYes}
                className="w-full justify-center"
              >
                네, 있어요 — 직접 입력하겠습니다
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleNo}
                className="w-full justify-center"
              >
                아니요 — AI가 제안해 주세요
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-100 mb-2 text-center">캡스톤 과제를 입력하세요</h1>
            <p className="text-gray-400 text-center text-sm mb-8">
              달성하고 싶은 목표나 완수하고 싶은 프로젝트를 자유롭게 적어주세요.
            </p>
            <textarea
              value={capstoneText}
              onChange={(e) => setCapstoneText(e.target.value)}
              placeholder="예: 파이썬으로 간단한 웹 스크래퍼를 만들어 뉴스 헤드라인을 수집하고 CSV로 저장한다."
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setHasCapstone(null)}
                className="flex-1 justify-center"
              >
                뒤로
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleNext}
                disabled={!capstoneText.trim()}
                className="flex-1 justify-center"
              >
                다음
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
