import { nanoid } from 'nanoid';
import type {
  AppState,
  StudyProject,
  CapstoneCandidate,
  CapstoneNode,
  KnowledgeNode,
  Edge,
  TestGoal,
  TestRecord,
  CanvasState,
  GraphPatch,
  CapstoneAttemptLog,
  ModelProvider,
  PendingTest,
} from './types';
import { DEFAULT_PROVIDER, DEFAULT_OPENAI_MODEL, DEFAULT_ANTHROPIC_MODEL } from './types';
import { applyPatch } from './graphPatch';
import { computeLayeredLayout } from './graph';
import { deleteProject } from '../services/storageRepository';

export type AppAction =
  | { type: 'SET_PROVIDER'; provider: ModelProvider }
  | { type: 'SET_MODEL'; provider: ModelProvider; modelId: string }
  | { type: 'NAVIGATE'; view: AppState['view'] }
  | { type: 'CREATE_PROJECT'; title: string; inputMode: 'learning_content' | 'capstone'; originalInput: string }
  | { type: 'LOAD_PROJECT'; project: StudyProject }
  | { type: 'SET_CAPSTONE_CANDIDATES'; candidates: CapstoneCandidate[] }
  | { type: 'CONFIRM_CAPSTONE'; capstone: CapstoneNode }
  | { type: 'SET_DAG_DRAFT'; nodes: Record<string, KnowledgeNode>; edges: Edge[] }
  | { type: 'APPLY_GRAPH_PATCH'; patch: GraphPatch }
  | { type: 'SET_PATCH_PREVIEW'; patch: GraphPatch | undefined }
  | { type: 'SET_TEST_GOAL'; nodeId: string; testGoal: TestGoal }
  | { type: 'START_NODE'; nodeId: string }
  | { type: 'SET_NODE_STATUS'; nodeId: string; status: KnowledgeNode['status'] }
  | { type: 'COMPLETE_NODE'; nodeId: string }
  | { type: 'SAVE_TEST_RECORD'; record: TestRecord }
  | { type: 'UPDATE_CANVAS_STATE'; canvas: Partial<CanvasState> }
  | { type: 'SELECT_NODE'; nodeId: string | undefined }
  | { type: 'START_CAPSTONE_ATTEMPT' }
  | { type: 'COMPLETE_CAPSTONE'; log: CapstoneAttemptLog; result: 'achieved' | 'failed' }
  | { type: 'SET_LLM_LOADING'; operation: AppState['llm']['operation'] }
  | { type: 'SET_LLM_ERROR'; error: string }
  | { type: 'CLEAR_LLM_STATE' }
  | { type: 'START_TEST_SESSION'; exam: AppState['testSession'] extends undefined ? never : NonNullable<AppState['testSession']> }
  | { type: 'UPDATE_TEST_ANSWER'; questionId: string; answer: string }
  | { type: 'SUBMIT_QUESTION'; questionId: string }
  | { type: 'COMPLETE_TEST_SESSION'; record: TestRecord }
  | { type: 'UPDATE_NODE_NOTES'; nodeId: string; notes: string[] }
  | { type: 'REQUEST_TEST'; pending: PendingTest }
  | { type: 'REMOVE_PENDING_TEST'; pendingTestId: string }
  | { type: 'RESET_LAYOUT' }
  | { type: 'ARCHIVE_PROJECT' }
  | { type: 'DELETE_PROJECT'; projectId: string };

export const initialCanvasState: CanvasState = {
  viewport: { x: 0, y: 0, zoom: 1 },
  nodePositions: {},
  selectedIds: [],
  layoutMode: 'auto',
};

function loadSelectedModels(): { openai: string; anthropic: string } {
  try {
    const stored = localStorage.getItem('lt_selected_models');
    if (stored) return JSON.parse(stored);
  } catch {}
  return { openai: DEFAULT_OPENAI_MODEL, anthropic: DEFAULT_ANTHROPIC_MODEL };
}

export const initialState: AppState = {
  view: 'home',
  selectedProvider: (localStorage.getItem('lt_model_provider') as ModelProvider) ?? DEFAULT_PROVIDER,
  selectedModels: loadSelectedModels(),
  canvas: initialCanvasState,
  llm: { isLoading: false, operation: null },
};

function now() {
  return new Date().toISOString();
}

function migrateProject(project: StudyProject): StudyProject {
  return {
    ...project,
    pendingTests: project.pendingTests ?? [],
  };
}

function computeAllPositions(
  project: StudyProject,
  existingPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const newPositions = computeLayeredLayout(project.nodes, project.edges);
  const merged = { ...newPositions, ...existingPositions };
  const finalPositions: typeof merged = {};
  for (const id of Object.keys(project.nodes)) {
    finalPositions[id] = merged[id] ?? newPositions[id] ?? { x: 0, y: 0 };
  }
  // Preserve capstone positions
  for (const capstone of project.capstones) {
    finalPositions[capstone.id] = merged[capstone.id] ?? { x: 800, y: 300 };
  }
  return finalPositions;
}

export function projectReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROVIDER':
      localStorage.setItem('lt_model_provider', action.provider);
      return { ...state, selectedProvider: action.provider };

    case 'SET_MODEL': {
      const updated = { ...state.selectedModels, [action.provider]: action.modelId };
      localStorage.setItem('lt_selected_models', JSON.stringify(updated));
      return { ...state, selectedModels: updated };
    }

    case 'NAVIGATE':
      return { ...state, view: action.view };

    case 'CREATE_PROJECT': {
      const project: StudyProject = {
        id: nanoid(),
        title: action.title,
        inputMode: action.inputMode,
        originalInput: action.originalInput,
        status: 'intake',
        capstones: [],
        nodes: {},
        edges: [],
        activeCapstoneId: '',
        graphVersion: 0,
        testGoals: {},
        testRecords: {},
        pendingTests: [],
        events: [],
        createdAt: now(),
        updatedAt: now(),
      };
      return {
        ...state,
        project,
        currentProjectId: project.id,
        view: 'intake-step1',
        canvas: initialCanvasState,
      };
    }

    case 'LOAD_PROJECT': {
      const project = migrateProject(action.project);
      return {
        ...state,
        project,
        currentProjectId: project.id,
        view: statusToView(project.status),
        canvas: initialCanvasState,
      };
    }

    case 'SET_CAPSTONE_CANDIDATES':
      return {
        ...state,
        capstoneCandidates: action.candidates,
        view: 'intake-step3',
        project: state.project
          ? { ...state.project, status: 'capstone_review', updatedAt: now() }
          : state.project,
      };

    case 'CONFIRM_CAPSTONE': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        capstones: [action.capstone],
        activeCapstoneId: action.capstone.id,
        status: 'dag_review',
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'SET_DAG_DRAFT': {
      if (!state.project) return state;
      const positions = computeLayeredLayout(action.nodes, action.edges);

      const activeCapstone = state.project.capstones.find(
        (c) => c.id === state.project!.activeCapstoneId
      );
      if (activeCapstone) {
        const posValues = Object.values(positions);
        const maxX = posValues.length > 0 ? Math.max(...posValues.map((p) => p.x)) : 0;
        const avgY =
          posValues.length > 0
            ? Math.round(posValues.reduce((sum, p) => sum + p.y, 0) / posValues.length)
            : 300;
        positions[activeCapstone.id] = { x: maxX + 280, y: avgY };
      }

      const project: StudyProject = {
        ...state.project,
        nodes: action.nodes,
        edges: action.edges,
        status: 'learning',
        graphVersion: 1,
        updatedAt: now(),
        events: [
          ...state.project.events,
          {
            id: nanoid(),
            type: 'dag_created',
            summary: '초기 DAG 생성',
            graphVersion: 1,
            createdAt: now(),
          },
        ],
      };
      return {
        ...state,
        project,
        view: 'dag-workspace',
        canvas: {
          ...initialCanvasState,
          nodePositions: positions,
          layoutMode: 'auto',
        },
      };
    }

    case 'APPLY_GRAPH_PATCH': {
      if (!state.project) return state;
      const updated = applyPatch(action.patch, state.project);
      const finalPositions = computeAllPositions(updated, state.canvas.nodePositions);
      return {
        ...state,
        project: updated,
        patchPreview: undefined,
        canvas: { ...state.canvas, nodePositions: finalPositions },
      };
    }

    case 'SET_PATCH_PREVIEW':
      return { ...state, patchPreview: action.patch };

    case 'SET_TEST_GOAL': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        testGoals: { ...state.project.testGoals, [action.nodeId]: action.testGoal },
        nodes: {
          ...state.project.nodes,
          [action.nodeId]: {
            ...state.project.nodes[action.nodeId],
            testGoalStatus: 'ready',
            currentTestGoalId: action.testGoal.id,
            updatedAt: now(),
          },
        },
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'START_NODE': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        nodes: {
          ...state.project.nodes,
          [action.nodeId]: {
            ...state.project.nodes[action.nodeId],
            status: 'studying',
            updatedAt: now(),
          },
        },
        updatedAt: now(),
      };
      return { ...state, project, selectedNodeId: action.nodeId };
    }

    case 'SET_NODE_STATUS': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        nodes: {
          ...state.project.nodes,
          [action.nodeId]: {
            ...state.project.nodes[action.nodeId],
            status: action.status,
            updatedAt: now(),
          },
        },
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'COMPLETE_NODE': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        nodes: {
          ...state.project.nodes,
          [action.nodeId]: {
            ...state.project.nodes[action.nodeId],
            status: 'completed',
            updatedAt: now(),
          },
        },
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'SAVE_TEST_RECORD': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        testRecords: { ...state.project.testRecords, [action.record.id]: action.record },
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'UPDATE_CANVAS_STATE':
      return { ...state, canvas: { ...state.canvas, ...action.canvas } };

    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.nodeId };

    case 'START_CAPSTONE_ATTEMPT': {
      if (!state.project) return state;
      const updated: StudyProject = {
        ...state.project,
        capstones: state.project.capstones.map((c) =>
          c.id === state.project!.activeCapstoneId ? { ...c, status: 'attempting' } : c
        ),
        updatedAt: now(),
      };
      return { ...state, project: updated, view: 'capstone-attempt' };
    }

    case 'COMPLETE_CAPSTONE': {
      if (!state.project) return state;
      const project: StudyProject = {
        ...state.project,
        status: action.result === 'achieved' ? 'completed' : 'learning',
        capstones: state.project.capstones.map((c) =>
          c.id === state.project!.activeCapstoneId
            ? { ...c, status: action.result, attemptLogs: [...c.attemptLogs, action.log] }
            : c
        ),
        updatedAt: now(),
      };
      return { ...state, project };
    }

    case 'SET_LLM_LOADING':
      return { ...state, llm: { isLoading: true, operation: action.operation } };

    case 'SET_LLM_ERROR':
      return { ...state, llm: { isLoading: false, operation: null, error: action.error } };

    case 'CLEAR_LLM_STATE':
      return { ...state, llm: { isLoading: false, operation: null } };

    case 'START_TEST_SESSION':
      return { ...state, testSession: action.exam, view: 'test-running' };

    case 'UPDATE_TEST_ANSWER':
      if (!state.testSession) return state;
      return {
        ...state,
        testSession: {
          ...state.testSession,
          answers: { ...state.testSession.answers, [action.questionId]: action.answer },
        },
      };

    case 'SUBMIT_QUESTION':
      if (!state.testSession) return state;
      return {
        ...state,
        testSession: {
          ...state.testSession,
          submittedQuestionIds: [...state.testSession.submittedQuestionIds, action.questionId],
        },
      };

    case 'COMPLETE_TEST_SESSION':
      if (!state.testSession) return state;
      return {
        ...state,
        testSession: { ...state.testSession, result: action.record },
        view: 'test-result',
      };

    case 'UPDATE_NODE_NOTES': {
      if (!state.project) return state;
      return {
        ...state,
        project: {
          ...state.project,
          nodes: {
            ...state.project.nodes,
            [action.nodeId]: {
              ...state.project.nodes[action.nodeId],
              notes: action.notes,
              updatedAt: now(),
            },
          },
          updatedAt: now(),
        },
      };
    }

    case 'REQUEST_TEST': {
      if (!state.project) return state;
      // Don't duplicate if same node already pending
      const alreadyPending = state.project.pendingTests.some(
        (t) => t.nodeId === action.pending.nodeId
      );
      if (alreadyPending) return state;
      return {
        ...state,
        project: {
          ...state.project,
          pendingTests: [...state.project.pendingTests, action.pending],
          updatedAt: now(),
        },
      };
    }

    case 'REMOVE_PENDING_TEST': {
      if (!state.project) return state;
      return {
        ...state,
        project: {
          ...state.project,
          pendingTests: state.project.pendingTests.filter((t) => t.id !== action.pendingTestId),
          updatedAt: now(),
        },
      };
    }

    case 'RESET_LAYOUT': {
      if (!state.project) return state;
      const positions = computeLayeredLayout(state.project.nodes, state.project.edges);
      const activeCapstone = state.project.capstones.find(
        (c) => c.id === state.project!.activeCapstoneId
      );
      if (activeCapstone) {
        const posValues = Object.values(positions);
        const maxX = posValues.length > 0 ? Math.max(...posValues.map((p) => p.x)) : 0;
        const avgY =
          posValues.length > 0
            ? Math.round(posValues.reduce((sum, p) => sum + p.y, 0) / posValues.length)
            : 300;
        positions[activeCapstone.id] = { x: maxX + 280, y: avgY };
      }
      return {
        ...state,
        canvas: { ...state.canvas, nodePositions: positions, layoutMode: 'auto' },
      };
    }

    case 'ARCHIVE_PROJECT': {
      if (!state.project) return state;
      return {
        ...state,
        project: { ...state.project, status: 'archived', updatedAt: now() },
      };
    }

    case 'DELETE_PROJECT': {
      deleteProject(action.projectId);
      const isCurrentProject = state.project?.id === action.projectId;
      if (isCurrentProject) {
        return {
          ...state,
          project: undefined,
          currentProjectId: undefined,
          selectedNodeId: undefined,
          patchPreview: undefined,
          canvas: initialCanvasState,
          view: 'home',
        };
      }
      return state;
    }

    default:
      return state;
  }
}

function statusToView(status: StudyProject['status']): AppState['view'] {
  switch (status) {
    case 'intake': return 'intake-step1';
    case 'capstone_review': return 'intake-step3';
    case 'dag_review':
    case 'learning':
    case 'capstone_ready': return 'dag-workspace';
    case 'completed': return 'achievement-log';
    case 'archived': return 'home';
    default: return 'home';
  }
}
