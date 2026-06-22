import type { StudyProject, CanvasState } from '../domain/types';

const PROJECT_PREFIX = 'lt_project_';
const CANVAS_PREFIX = 'lt_canvas_';
const PROJECT_LIST_KEY = 'lt_project_list';

export type ProjectSummary = {
  id: string;
  title: string;
  status: StudyProject['status'];
  updatedAt: string;
  createdAt: string;
};

export function saveProject(project: StudyProject): void {
  try {
    localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(project));
    const list = listProjects();
    const idx = list.findIndex((p) => p.id === project.id);
    const summary: ProjectSummary = {
      id: project.id,
      title: project.title,
      status: project.status,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
    };
    if (idx >= 0) {
      list[idx] = summary;
    } else {
      list.push(summary);
    }
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save project', e);
  }
}

export function loadProject(id: string): StudyProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as StudyProject;
  } catch {
    return null;
  }
}

export function listProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectSummary[];
  } catch {
    return [];
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  localStorage.removeItem(CANVAS_PREFIX + id);
  const list = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
}

export function saveCanvasState(projectId: string, canvas: CanvasState): void {
  try {
    localStorage.setItem(CANVAS_PREFIX + projectId, JSON.stringify(canvas));
  } catch (e) {
    console.error('Failed to save canvas state', e);
  }
}

export function loadCanvasState(projectId: string): CanvasState | null {
  try {
    const raw = localStorage.getItem(CANVAS_PREFIX + projectId);
    if (!raw) return null;
    return JSON.parse(raw) as CanvasState;
  } catch {
    return null;
  }
}
