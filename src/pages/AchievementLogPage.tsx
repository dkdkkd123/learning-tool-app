import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { generateAchievementLog, type AchievementLog } from '../services/llmGateway';
import { getModelConfig } from '../domain/types';

export function AchievementLogPage() {
  const { state, dispatch } = useApp();
  const { project } = state;

  const [log, setLog] = useState<AchievementLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const activeCapstone = project?.capstones.find((c) => c.id === project.activeCapstoneId);
  const completedNodes = project
    ? Object.values(project.nodes).filter((n) => n.status === 'completed')
    : [];
  const testRecords = project ? Object.values(project.testRecords) : [];

  useEffect(() => {
    if (project && !log) {
      loadLog();
    }
  }, []);

  async function loadLog() {
    if (!project) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await generateAchievementLog(
        project,
        testRecords,
        project.events,
        completedNodes,
        getModelConfig(state)
      );
      setLog(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '성취 기록 생성 실패');
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportMarkdown() {
    if (!log || !project) return;
    const md = [
      `# ${log.title}`,
      '',
      `## 학습 프로젝트: ${project.title}`,
      '',
      `## 요약`,
      log.summary,
      '',
      activeCapstone ? `## 캡스톤 과제\n**${activeCapstone.title}**\n\n${activeCapstone.description}\n\n성공 기준: ${activeCapstone.successCriteria}` : '',
      '',
      `## 숙달한 개념`,
      log.masteredConcepts.map((c) => `- ${c}`).join('\n'),
      '',
      log.challengingConcepts.length > 0 ? `## 도전적이었던 개념\n${log.challengingConcepts.map((c) => `- ${c}`).join('\n')}` : '',
      '',
      log.misconceptionsOvercome.length > 0 ? `## 극복한 오개념\n${log.misconceptionsOvercome.map((c) => `- ${c}`).join('\n')}` : '',
      '',
      `## 핵심 인사이트`,
      log.keyInsights.map((i) => `- ${i}`).join('\n'),
      '',
      `## 다음 학습 제안`,
      log.nextSuggestions.map((s) => `- ${s}`).join('\n'),
      '',
      `## 성찰`,
      log.reflectionText,
      '',
      `---`,
      `*생성일: ${new Date().toLocaleString('ko-KR')}*`,
    ].filter((l) => l !== '').join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `achievement-log-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" message="성취 기록을 생성하는 중..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Nav */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', view: 'dag-workspace' })}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            ← 워크스페이스
          </button>
          <Button variant="secondary" size="sm" onClick={handleExportMarkdown} disabled={!log}>
            내보내기 (Markdown)
          </Button>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-sm text-red-300">
            {error}
            <Button size="sm" variant="ghost" onClick={loadLog} className="mt-2">다시 시도</Button>
          </div>
        )}

        {log ? (
          <div className="flex flex-col gap-6">
            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold text-gray-100 mb-1">{log.title}</h1>
              {activeCapstone && (
                <div className="flex items-center gap-2 text-sm text-purple-400">
                  <span>◆</span>
                  <span>{activeCapstone.status === 'achieved' ? '달성' : '도전 중'}: {activeCapstone.title}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">요약</h2>
              <p className="text-gray-300 leading-relaxed">{log.summary}</p>
            </div>

            {/* Concepts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {log.masteredConcepts.length > 0 && (
                <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-4">
                  <h2 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">숙달한 개념</h2>
                  <ul className="flex flex-col gap-1">
                    {log.masteredConcepts.map((c, i) => (
                      <li key={i} className="text-sm text-emerald-300 flex items-center gap-1.5">
                        <span className="text-emerald-500">✓</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {log.challengingConcepts.length > 0 && (
                <div className="bg-orange-950 border border-orange-900 rounded-xl p-4">
                  <h2 className="text-xs font-medium text-orange-400 uppercase tracking-wide mb-2">도전적인 개념</h2>
                  <ul className="flex flex-col gap-1">
                    {log.challengingConcepts.map((c, i) => (
                      <li key={i} className="text-sm text-orange-300">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Insights */}
            {log.keyInsights.length > 0 && (
              <div className="bg-blue-950 border border-blue-900 rounded-xl p-4">
                <h2 className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-2">핵심 인사이트</h2>
                <ul className="flex flex-col gap-1.5">
                  {log.keyInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-blue-300 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">→</span>{insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reflection */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">성찰</h2>
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{log.reflectionText}</div>
            </div>

            {/* Next steps */}
            {log.nextSuggestions.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">다음 학습 제안</h2>
                <ul className="flex flex-col gap-1.5">
                  {log.nextSuggestions.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">{i + 1}.</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-100">{completedNodes.length}</div>
                <div className="text-xs text-gray-500 mt-1">완료된 노드</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-100">{testRecords.length}</div>
                <div className="text-xs text-gray-500 mt-1">테스트 횟수</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-100">
                  {testRecords.length > 0
                    ? Math.round(
                        (testRecords.filter((r) => r.summary.overallVerdict === 'pass').length /
                          testRecords.length) *
                          100
                      )
                    : 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">합격률</div>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() => dispatch({ type: 'NAVIGATE', view: 'home' })}
              className="w-full justify-center"
            >
              홈으로
            </Button>
          </div>
        ) : !error ? (
          <div className="text-center py-20 text-gray-500">성취 기록을 불러오는 중...</div>
        ) : null}
      </div>
    </div>
  );
}
