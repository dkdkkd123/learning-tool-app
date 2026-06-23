import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { listProjects, loadProject, type ProjectSummary } from '../services/storageRepository';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

type StudyProjectStatus = 'intake' | 'capstone_review' | 'dag_review' | 'learning' | 'capstone_ready' | 'completed' | 'archived';

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
  const { dispatch } = useApp();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const list = listProjects().filter((p) => p.status !== 'archived');
    setProjects(list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  }, []);

  function handleLoadProject(id: string) {
    const project = loadProject(id);
    if (project) {
      dispatch({ type: 'LOAD_PROJECT', project });
    }
  }

  function handleDeleteProject(id: string) {
    dispatch({ type: 'DELETE_PROJECT', projectId: id });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-100 mb-1">Learning Tool</h1>
          <p className="text-gray-500 text-sm">캡스톤 기반 지식 그래프 학습 관리</p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'intake-step1' })}
          className="w-full justify-center mb-10"
        >
          + 새 학습 프로젝트 시작
        </Button>

        {projects.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              최근 프로젝트
            </h2>
            <div className="flex flex-col gap-2">
              {projects.map((p) => (
                <div key={p.id} className="relative group">
                  {confirmDeleteId === p.id ? (
                    <div className="bg-red-950 border border-red-800 rounded-xl p-4 flex items-center justify-between gap-3">
                      <span className="text-sm text-red-300">'{p.title}' 프로젝트를 삭제하시겠습니까?</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleLoadProject(p.id)}
                      className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-200 truncate">{p.title}</span>
                        <Badge color={statusColor(p.status as StudyProjectStatus)}>
                          {statusLabel(p.status as StudyProjectStatus)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(p.updatedAt).toLocaleString('ko-KR')}
                      </div>
                    </button>
                  )}
                  {confirmDeleteId !== p.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all text-sm"
                      title="프로젝트 삭제"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
