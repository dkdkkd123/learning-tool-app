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
} from './types';
import { DEFAULT_PROVIDER } from './types';
import { applyPatch } from './graphPatch';
import { computeLayeredLayout } from './graph';

export type AppAction =
  | { type: 'SET_PROVIDER'; provider: ModelProvider }
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
  | { type: 'ARCHIVE_PROJECT' };

export const initialCanvasState: CanvasState = {
  viewport: { x: 0, y: 0, zoom: 1 },
  nodePositions: {},
  selectedIds: [],
  layoutMode: 'auto',
};

export const initialState: AppState = {
  view: 'home',
  selectedProvider: (localStorage.getItem('lt_model_provider') as ModelProvider) ?? DEFAULT_PROVIDER,
  canvas: initialCanvasState,
  llm: { isLoading: false, operation: null },
};

function now() {
  return new Date().toISOString();
}

export function projectReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROVIDER':
      localStorage.setItem('lt_model_provider', action.provider);
      return { ...state, selectedProvider: action.provider };

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
        events: [],
        createdAt: now(),
        updatedAt: now(),
      };
      return {
        ...state,
        project,
        currentProjectId: project.id,
        view: 'intake',
        canvas: initialCanvasState,
      };
    }

    case 'LOAD_PROJECT':
      return {
        ...state,
        project: action.project,
        currentProjectId: action.project.id,
        view: statusToView(action.project.status),
        canvas: initialCanvasState,
      };

    case 'SET_CAPSTONE_CANDIDATES':
      return {
        ...state,
        capstoneCandidates: action.candidates,
        view: 'capstone-review',
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

      // Place the active capstone node to the right of the last knowledge layer
      const activeCapstone = state.project.capstones.find(
        (c) => c.id === state.project!.activeCapstoneId
      );
      if (activeCapstone) {
        const posValues = Object.values(positions);
        const maxX = posValues.length > 0 ? Math.max(...posValues.map((p) => p.x)) : 0;
        const avgY = posValues.length > 0
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
      // Recompute positions for new nodes
      const existingPositions = state.canvas.nodePositions;
      const newPositions = computeLayeredLayout(updated.nodes, updated.edges);
      const mergedPositions = { ...newPositions, ...existingPositions };
      // Only keep positions for existing nodes
      const finalPositions: typeof mergedPositions = {};
      for (const id of Object.keys(updated.nodes)) {
        finalPositions[id] = mergedPositions[id] ?? newPositions[id] ?? { x: 0, y: 0 };
      }
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
      const activeCapstone = state.project.capstones.find(
        (c) => c.id === state.project!.activeCapstoneId
      );
      if (!activeCapstone) return state;
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
            ? {
                ...c,
                status: action.result,
                attemptLogs: [...c.attemptLogs, action.log],
              }
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

    case 'ARCHIVE_PROJECT': {
      if (!state.project) return state;
      return {
        ...state,
        project: { ...state.project, status: 'archived', updatedAt: now() },
      };
    }

    default:
      return state;
  }
}

function statusToView(status: StudyProject['status']): AppState['view'] {
  switch (status) {
    case 'intake': return 'intake';
    case 'capstone_review': return 'capstone-review';
    case 'dag_review':
    case 'learning':
    case 'capstone_ready': return 'dag-workspace';
    case 'completed': return 'achievement-log';
    case 'archived': return 'home';
    default: return 'home';
  }
}
