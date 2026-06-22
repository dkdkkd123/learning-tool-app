import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { gradeExam } from '../services/llmGateway';

const typeLabels: Record<number, string> = {
  1: '개념 이해',
  2: '적용',
  3: '분석/비교',
  4: '역추론',
  5: '종합 응용',
};

export function TestRunnerPage() {
  const { state, dispatch } = useApp();
  const { testSession, project } = state;

  const [localIndex, setLocalIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [isGrading, setIsGrading] = useState(false);

  if (!testSession || !project) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">시험 세션이 없습니다.</div>
      </div>
    );
  }

  const { exam, answerKey } = testSession;
  const currentQuestion = exam.questions[localIndex];
  const isCurrentSubmitted = submitted.has(currentQuestion?.id ?? '');
  const isLastQuestion = localIndex === exam.questions.length - 1;
  const currentAnswer = localAnswers[currentQuestion?.id ?? ''] ?? '';

  function handleAnswerChange(value: string) {
    if (!currentQuestion || isCurrentSubmitted) return;
    setLocalAnswers((a) => ({ ...a, [currentQuestion.id]: value }));
  }

  async function handleSubmitQuestion() {
    if (!currentQuestion || isCurrentSubmitted) return;
    const newSubmitted = new Set(submitted);
    newSubmitted.add(currentQuestion.id);
    setSubmitted(newSubmitted);

    if (isLastQuestion) {
      await handleGrade({ ...localAnswers }, newSubmitted);
    } else {
      setTimeout(() => setLocalIndex((i) => i + 1), 300);
    }
  }

  async function handleGrade(answers: Record<string, string>, submittedSet: Set<string>) {
    const node = project!.nodes[exam.nodeId];
    const testGoal = node?.currentTestGoalId ? project!.testGoals[node.currentTestGoalId] : null;
    if (!testGoal) return;

    setIsGrading(true);
    try {
      const allAnswers = { ...answers };
      // Fill blanks for unanswered
      for (const q of exam.questions) {
        if (!allAnswers[q.id]) allAnswers[q.id] = '';
      }
      const { results, summary } = await gradeExam(exam, answerKey, allAnswers, testGoal, state.selectedProvider);
      const record = {
        id: nanoid(),
        examId: exam.id,
        testGoalId: exam.testGoalId,
        nodeId: exam.nodeId,
        difficulty: exam.difficulty,
        submittedAnswers: allAnswers,
        results,
        summary,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'SAVE_TEST_RECORD', record });
      dispatch({ type: 'COMPLETE_TEST_SESSION', record });
    } catch (e) {
      console.error('Grading failed', e);
    } finally {
      setIsGrading(false);
    }
  }

  if (isGrading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="채점 중..." />
      </div>
    );
  }

  if (!currentQuestion) return null;

  const node = project.nodes[exam.nodeId];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-semibold text-gray-200">{node?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge color="blue">{exam.difficulty}</Badge>
              <span className="text-xs text-gray-500">{exam.topic}</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {localIndex + 1} / {exam.questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full mb-8">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((localIndex + 1) / exam.questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge color="gray">{typeLabels[currentQuestion.type] ?? `Type ${currentQuestion.type}`}</Badge>
            {currentQuestion.type === 4 && (
              <span className="text-xs text-orange-400">직접 언급 없이 추론하세요</span>
            )}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">
            {currentQuestion.content}
          </div>
        </div>

        {/* Answer area */}
        <div className="mb-6">
          <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide">답변</label>
          <textarea
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            disabled={isCurrentSubmitted}
            placeholder="답변을 작성하세요..."
            rows={6}
            className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors ${
              isCurrentSubmitted
                ? 'bg-gray-900 border-gray-700 opacity-70 cursor-not-allowed'
                : 'bg-gray-800 border-gray-700'
            }`}
          />
        </div>

        {isCurrentSubmitted && !isLastQuestion ? (
          <div className="text-center py-2 text-blue-400 text-sm animate-pulse">다음 문제로...</div>
        ) : isCurrentSubmitted && isLastQuestion ? (
          <div className="text-center py-2 text-gray-500 text-sm">채점 중...</div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmitQuestion}
            disabled={!currentAnswer.trim()}
            className="w-full justify-center"
          >
            {isLastQuestion ? '제출 및 채점' : '제출'}
          </Button>
        )}

        {/* Progress dots */}
        {exam.questions.length > 1 && (
          <div className="mt-8 flex gap-2 justify-center">
            {exam.questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < localIndex
                    ? 'bg-blue-500'
                    : i === localIndex
                    ? 'bg-blue-300'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
