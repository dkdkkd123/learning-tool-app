import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { listProjects, loadProject, type ProjectSummary } from '../services/storageRepository';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MODEL_OPTIONS } from '../domain/types';

function statusColor(status: StudyProjectStatus): 'gray' | 'blue' | 'green' | 'yellow' | 'purple' {
  switch (status) {
    case 'learning': return 'blue';
    case 'completed': return 'green';
    case 'capstone_review':
    case 'dag_review': return 'yellow';
    case 'capstone_ready': return 'purple';
    default: return 'gray';
  }
}

type StudyProjectStatus = 'intake' | 'capstone_review' | 'dag_review' | 'learning' | 'capstone_ready' | 'completed' | 'archived';

function statusLabel(status: StudyProjectStatus): string {
  const labels: Record<StudyProjectStatus, string> = {
    intake: '입력 중',
    capstone_review: '캡스톤 검토',
    dag_review: 'DAG 검토',
    learning: '학습 중',
    capstone_ready: '캡스톤 준비',
    completed: '완료',
    archived: '보관됨',
  };
  return labels[status] ?? status;
}

export function HomePage() {
  const { state, dispatch } = useApp();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    const list = listProjects().filter((p) => p.status !== 'archived');
    setProjects(list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  }, []);

  function handleNewProject() {
    dispatch({ type: 'NAVIGATE', view: 'intake' });
  }

  function handleLoadProject(id: string) {
    const project = loadProject(id);
    if (project) {
      dispatch({ type: 'LOAD_PROJECT', project });
    }
  }

  const isApiKeySet =
    state.selectedProvider === 'anthropic'
      ? !!import.meta.env.VITE_ANTHROPIC_API_KEY
      : !!import.meta.env.VITE_OPENAI_API_KEY;

  const apiKeyEnvVar =
    state.selectedProvider === 'anthropic' ? 'VITE_ANTHROPIC_API_KEY=sk-ant-...' : 'VITE_OPENAI_API_KEY=sk-...';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Learning Tool</h1>
          <p className="text-gray-400">캡스톤 기반 지식 그래프 학습 시스템</p>
        </div>

        {/* Model Selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">AI 모델 선택</div>
          <div className="flex gap-2">
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.provider}
                onClick={() => dispatch({ type: 'SET_PROVIDER', provider: opt.provider })}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors border ${
                  state.selectedProvider === opt.provider
                    ? 'bg-blue-700 border-blue-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* API key warning */}
        {!isApiKeySet && (
          <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 text-sm">
            <div className="font-medium text-yellow-300 mb-1">API 키가 설정되지 않았습니다</div>
            <div className="text-yellow-400">
              프로젝트 루트에 <code className="bg-yellow-900 px-1 rounded">.env.local</code> 파일을 만들고
              <code className="bg-yellow-900 px-1 rounded ml-1">{apiKeyEnvVar}</code>
              를 설정하세요.
            </div>
          </div>
        )}

        {/* Start new */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleNewProject}
          className="w-full justify-center"
        >
          새 학습 프로젝트 시작
        </Button>

        {/* Existing projects */}
        {projects.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">최근 프로젝트</h2>
            <div className="flex flex-col gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLoadProject(p.id)}
                  className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-200 truncate">{p.title}</span>
                    <Badge color={statusColor(p.status as StudyProjectStatus)}>
                      {statusLabel(p.status as StudyProjectStatus)}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(p.updatedAt).toLocaleString('ko-KR')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
