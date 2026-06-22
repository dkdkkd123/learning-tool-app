import React from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const difficultyOrder = ['초급', '중급', '고급'] as const;

export function TestResultPage() {
  const { state, dispatch } = useApp();
  const { testSession, project } = state;

  if (!testSession?.result || !project) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">결과가 없습니다.</div>
      </div>
    );
  }

  const record = testSession.result;
  const { exam, answerKey } = testSession;
  const node = project.nodes[record.nodeId];
  const testGoal = node?.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;

  const isPassed = record.summary.overallVerdict === 'pass';
  const meetsCompletion =
    isPassed &&
    testGoal &&
    difficultyOrder.indexOf(record.difficulty) >=
      difficultyOrder.indexOf(testGoal.completionRule.requiredDifficulty);

  function handleCompleteNode() {
    dispatch({ type: 'COMPLETE_NODE', nodeId: record.nodeId });
    dispatch({ type: 'NAVIGATE', view: 'dag-workspace' });
  }

  function handleRetry() {
    dispatch({ type: 'NAVIGATE', view: 'node-study' });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Result summary */}
        <div className={`rounded-2xl p-6 mb-8 ${
          isPassed ? 'bg-emerald-950 border border-emerald-800' : 'bg-red-950 border border-red-900'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{isPassed ? '✓' : '✗'}</span>
            <div>
              <div className="text-xl font-bold">{isPassed ? '합격' : '불합격'}</div>
              <div className="text-sm text-gray-400">
                {record.summary.passCount} / {record.summary.totalCount} 통과 · {record.difficulty} 난이도
              </div>
            </div>
          </div>
          {record.summary.nextDifficulty && record.summary.nextDifficulty !== 'completed' && (
            <div className="text-sm text-gray-400 mt-2">
              다음 시도: <span className="text-gray-200 font-medium">{record.summary.nextDifficulty}</span>
            </div>
          )}
        </div>

        {/* Misconceptions */}
        {record.summary.misconceptions.length > 0 && (
          <div className="bg-orange-950 border border-orange-900 rounded-xl p-4 mb-6">
            <div className="text-sm font-medium text-orange-300 mb-2">발견된 오개념</div>
            <ul className="list-disc list-inside flex flex-col gap-1">
              {record.summary.misconceptions.map((m, i) => (
                <li key={i} className="text-sm text-orange-200">{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-question results */}
        <div className="flex flex-col gap-4 mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">문제별 결과</h2>
          {exam.questions.map((question, idx) => {
            const result = record.results.find((r) => r.questionId === question.id);
            const modelAnswer = answerKey.answers[question.id];
            const submitted = record.submittedAnswers[question.id];
            return (
              <div key={question.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">문제 {idx + 1}</span>
                  <Badge color={result?.verdict === 'pass' ? 'green' : 'red'}>
                    {result?.verdict === 'pass' ? '통과' : '미통과'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-300 mb-3 leading-relaxed">{question.content}</p>

                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">내 답변</div>
                    <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-2 leading-relaxed">
                      {submitted || '(미응답)'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">모범 답안</div>
                    <div className="text-sm text-emerald-300 bg-emerald-950/50 rounded-lg p-2 leading-relaxed">
                      {modelAnswer?.answer}
                    </div>
                  </div>
                  {result?.feedback && (
                    <div>
                      <div className="text-xs text-gray-600 mb-1">피드백</div>
                      <div className="text-sm text-gray-300 bg-gray-800 rounded-lg p-2 leading-relaxed">
                        {result.feedback}
                      </div>
                    </div>
                  )}
                  {result?.misconception && (
                    <div className="text-xs text-orange-400 bg-orange-950/50 rounded-lg p-2">
                      오개념: {result.misconception}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {meetsCompletion && (
            <Button variant="success" size="lg" onClick={handleCompleteNode} className="w-full justify-center">
              노드 완료
            </Button>
          )}
          <Button variant="secondary" size="md" onClick={handleRetry} className="w-full justify-center">
            {isPassed ? '다음 난이도 도전' : '다시 시도'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'NAVIGATE', view: 'dag-workspace' })} className="w-full justify-center">
            워크스페이스로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
