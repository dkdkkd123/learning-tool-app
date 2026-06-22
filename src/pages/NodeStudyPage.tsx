import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { generateExam, generateTestGoal, chatCompletion } from '../services/llmGateway';

export function NodeStudyPage() {
  const { state, dispatch } = useApp();
  const { project, selectedNodeId, llm } = state;

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  if (!project || !selectedNodeId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">노드를 선택해주세요.</div>
      </div>
    );
  }

  const node = project.nodes[selectedNodeId];
  if (!node) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">노드를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const testGoal = node.currentTestGoalId ? project.testGoals[node.currentTestGoalId] : null;
  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);

  const currentNotes = notes || node.notes.join('\n\n');

  function handleSaveNotes() {
    const noteList = notes.split('\n\n').filter((n) => n.trim());
    dispatch({ type: 'UPDATE_NODE_NOTES', nodeId: node.id, notes: noteList });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function handleStartTest() {
    if (!testGoal) {
      // Generate test goal first
      if (!activeCapstone) return;
      dispatch({ type: 'SET_LLM_LOADING', operation: 'test_goal' });
      try {
        const newTestGoal = await generateTestGoal(node, activeCapstone, state.selectedProvider);
        dispatch({ type: 'SET_TEST_GOAL', nodeId: node.id, testGoal: newTestGoal });
        await startTestWithGoal(newTestGoal);
      } catch (e) {
        dispatch({ type: 'SET_LLM_ERROR', error: String(e) });
      } finally {
        dispatch({ type: 'CLEAR_LLM_STATE' });
      }
      return;
    }
    await startTestWithGoal(testGoal);
  }

  async function startTestWithGoal(goal: typeof testGoal) {
    if (!goal) return;
    const pastRecords = Object.values(project!.testRecords).filter((r) => r.nodeId === node.id);
    const lastRecord = pastRecords[pastRecords.length - 1];
    const difficulty = lastRecord?.summary.nextDifficulty === 'completed'
      ? '고급'
      : (lastRecord?.summary.nextDifficulty ?? goal.difficultyPolicy.initial) as '초급' | '중급' | '고급';

    dispatch({ type: 'SET_LLM_LOADING', operation: 'exam' });
    try {
      const { exam, answerKey } = await generateExam(goal, node, difficulty, state.selectedProvider, pastRecords);
      const type4 = exam.questions.filter((q) => q.type === 4);
      const others = exam.questions.filter((q) => q.type !== 4);
      dispatch({
        type: 'START_TEST_SESSION',
        exam: {
          exam: { ...exam, questions: [...type4, ...others] },
          answerKey,
          currentQuestionIndex: 0,
          answers: {},
          submittedQuestionIds: [],
        },
      });
    } catch (e) {
      dispatch({ type: 'SET_LLM_ERROR', error: String(e) });
    } finally {
      dispatch({ type: 'CLEAR_LLM_STATE' });
    }
  }

  function handleMarkAsKnown() {
    dispatch({ type: 'COMPLETE_NODE', nodeId: node.id });
    dispatch({ type: 'NAVIGATE', view: 'dag-workspace' });
  }

  async function handleChatSubmit() {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory((h) => [...h, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const systemPrompt = `당신은 학습 도우미입니다. 현재 학습 중인 주제: "${node.name}"\n개요: ${node.summary}\n\n학습자의 질문에 명확하고 도움이 되는 답변을 제공하세요.`;
      const messages = [...chatHistory, { role: 'user' as const, content: userMsg }];
      const reply = await chatCompletion(messages, systemPrompt, state.selectedProvider);
      setChatHistory((h) => [...h, { role: 'assistant', content: reply }]);
    } catch (e) {
      setChatHistory((h) => [...h, { role: 'assistant', content: `오류: ${String(e)}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  if (llm.isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message={
          llm.operation === 'exam' ? '시험 문제를 생성하는 중...' :
          llm.operation === 'test_goal' ? '테스트 목표를 생성하는 중...' :
          '처리 중...'
        } />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', view: 'dag-workspace' })}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ← 워크스페이스
          </button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{node.name}</h1>
          <Badge color={node.status === 'completed' ? 'green' : node.status === 'studying' ? 'yellow' : 'gray'}>
            {node.status === 'completed' ? '완료' : node.status === 'studying' ? '학습 중' : '대기'}
          </Badge>
        </div>

        {/* Summary */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">개요</h2>
          <p className="text-gray-300 leading-relaxed">{node.summary}</p>
        </section>

        {/* Test Goal */}
        {testGoal && (
          <section className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">테스트 목표</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="font-medium text-gray-200 mb-1">{testGoal.topic}</div>
              <div className="text-sm text-gray-400 mb-3">{testGoal.targetDescription}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-gray-800 px-2 py-1 rounded text-gray-400">
                  완료 조건: {testGoal.completionRule.requiredDifficulty} 합격
                </span>
                {Object.entries(testGoal.questionPlan)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <span key={type} className="bg-gray-800 px-2 py-1 rounded text-gray-400">
                      {type}: {count}문항
                    </span>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* Notes */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">나의 노트</h2>
          <textarea
            value={currentNotes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => !notes && setNotes(node.notes.join('\n\n'))}
            placeholder="이 개념에 대한 노트를 작성하세요..."
            rows={5}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="secondary" onClick={handleSaveNotes}>
              {notesSaved ? '저장됨 ✓' : '저장'}
            </Button>
          </div>
        </section>

        {/* Chat Q&A */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">AI 질문하기</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {chatHistory.length > 0 && (
              <div className="p-4 flex flex-col gap-3 max-h-64 overflow-y-auto">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-xl px-3 py-2 text-sm max-w-xs lg:max-w-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-800 text-blue-100'
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-400">
                      답변 생성 중...
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 p-3 border-t border-gray-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                placeholder="이 개념에 대해 질문하세요..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button size="sm" variant="primary" onClick={handleChatSubmit} disabled={isChatLoading}>
                전송
              </Button>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button size="lg" variant="success" onClick={handleStartTest} className="w-full justify-center">
            테스트 시작
          </Button>
          {node.status !== 'completed' && (
            <Button size="md" variant="ghost" onClick={handleMarkAsKnown} className="w-full justify-center text-gray-500">
              이미 알고 있음 (제외)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
