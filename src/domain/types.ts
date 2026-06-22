export type NodeId = string;

export type StudyProject = {
  id: string;
  title: string;
  inputMode: 'learning_content' | 'capstone';
  originalInput: string;
  status: 'intake' | 'capstone_review' | 'dag_review' | 'learning' | 'capstone_ready' | 'completed' | 'archived';
  capstones: CapstoneNode[];
  nodes: Record<NodeId, KnowledgeNode>;
  edges: Edge[];
  activeCapstoneId: string;
  graphVersion: number;
  testGoals: Record<NodeId, TestGoal>;
  testRecords: Record<string, TestRecord>;
  events: ProjectEvent[];
  createdAt: string;
  updatedAt: string;
};

export type CapstoneNode = {
  id: string;
  kind: 'capstone';
  title: string;
  description: string;
  successCriteria: string;
  outputType: 'problem_solution' | 'project' | 'analysis' | 'implementation' | 'proof' | 'other';
  prerequisiteNodeIds: NodeId[];
  status: 'waiting' | 'ready' | 'attempting' | 'achieved' | 'failed';
  attemptLogs: CapstoneAttemptLog[];
};

export type KnowledgeNode = {
  id: string;
  kind: 'knowledge';
  name: string;
  summary: string;
  prerequisiteNodeIds: NodeId[];
  status: 'waiting' | 'studying' | 'completed' | 'excluded';
  testGoalStatus: 'none' | 'generating' | 'ready' | 'stale' | 'retired';
  currentTestGoalId?: string;
  notes: string[];
  createdBy: 'llm' | 'user';
  createdAt: string;
  updatedAt: string;
};

export type Edge = { from: NodeId; to: NodeId };

export type TestGoal = {
  id: string;
  nodeId: string;
  graphVersionCreated: number;
  topic: string;
  targetDescription: string;
  difficultyPolicy: {
    initial: '초급';
    onPass: 'next_difficulty';
    onFail: 'same_difficulty';
    maxDifficultyForCompletion: '초급' | '중급' | '고급';
  };
  questionPlan: { type1: number; type2: number; type3: number; type4: number; type5: number };
  completionRule: { requiredOverallVerdict: 'pass'; requiredDifficulty: '초급' | '중급' | '고급' };
  status: 'ready' | 'stale' | 'retired';
};

export type Question = {
  id: string;
  type: 1 | 2 | 3 | 4 | 5;
  content: string;
};

export type ModelAnswer = {
  questionId: string;
  answer: string;
  explanation: string;
};

export type ExamDocument = {
  id: string;
  testGoalId: string;
  nodeId: string;
  topic: string;
  difficulty: '초급' | '중급' | '고급';
  questions: Question[];
};

export type AnswerKey = {
  examId: string;
  answers: Record<string, ModelAnswer>;
  visibility: 'hidden_until_submitted';
};

export type QuestionResult = {
  questionId: string;
  verdict: 'pass' | 'fail';
  feedback: string;
  misconception?: string;
};

export type TestRecord = {
  id: string;
  examId: string;
  testGoalId: string;
  nodeId: string;
  difficulty: '초급' | '중급' | '고급';
  submittedAnswers: Record<string, string>;
  results: QuestionResult[];
  summary: {
    overallVerdict: 'pass' | 'fail';
    passCount: number;
    totalCount: number;
    misconceptions: string[];
    nextDifficulty: '초급' | '중급' | '고급' | 'completed';
  };
  createdAt: string;
};

export type GraphPatch = {
  id: string;
  reason: string;
  operations: GraphOperation[];
  expectedBaseVersion: number;
};

export type GraphOperation =
  | { type: 'add_node'; node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> }
  | { type: 'update_node'; nodeId: string; updates: Partial<KnowledgeNode> }
  | { type: 'remove_node'; nodeId: string }
  | { type: 'exclude_node'; nodeId: string }
  | { type: 'add_edge'; edge: Edge }
  | { type: 'remove_edge'; edge: Edge }
  | { type: 'split_node'; targetNodeId: string; replacementNodes: Partial<KnowledgeNode>[]; replacementEdges: Edge[]; mappingNote: string }
  | { type: 'merge_nodes'; sourceNodeIds: string[]; newNode: Partial<KnowledgeNode> }
  | { type: 'replace_subgraph'; targetNodeIds: string[]; newNodes: Partial<KnowledgeNode>[]; newEdges: Edge[]; reason: string };

export type CapstoneAttemptLog = {
  id: string;
  result: 'achieved' | 'failed';
  submittedOutput: string;
  judgementNote: string;
  createdAt: string;
};

export type ProjectEvent = {
  id: string;
  type: string;
  summary: string;
  graphVersion: number;
  createdAt: string;
};

export type CanvasState = {
  viewport: { x: number; y: number; zoom: number };
  nodePositions: Record<NodeId, { x: number; y: number }>;
  selectedIds: string[];
  focusedNodeId?: string;
  layoutMode: 'auto' | 'manual' | 'mixed';
};

export type CapstoneCandidate = {
  title: string;
  description: string;
  successCriteria: string;
  outputType: 'problem_solution' | 'project' | 'analysis' | 'implementation' | 'proof' | 'other';
  whyCanonical: string;
};

export type ModelProvider = 'openai' | 'anthropic';

export type ModelOption = {
  provider: ModelProvider;
  model: string;
  label: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  { provider: 'openai',    model: 'gpt-4o',              label: 'ChatGPT (GPT-4o)' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6',   label: 'Claude (Sonnet 4.6)' },
];

export const DEFAULT_PROVIDER: ModelProvider = 'openai';

export type AppView =
  | 'home'
  | 'intake'
  | 'capstone-review'
  | 'dag-workspace'
  | 'node-study'
  | 'test-running'
  | 'test-result'
  | 'capstone-attempt'
  | 'achievement-log';

export type AppState = {
  view: AppView;
  selectedProvider: ModelProvider;
  currentProjectId?: string;
  project?: StudyProject;
  capstoneCandidates?: CapstoneCandidate[];
  selectedNodeId?: string;
  canvas: CanvasState;
  llm: {
    isLoading: boolean;
    operation: 'capstone' | 'dag_draft' | 'test_goal' | 'exam' | 'grading' | 'graph_patch' | 'achievement_log' | null;
    error?: string;
  };
  patchPreview?: GraphPatch;
  testSession?: {
    exam: ExamDocument;
    answerKey: AnswerKey;
    currentQuestionIndex: number;
    answers: Record<string, string>;
    submittedQuestionIds: string[];
    result?: TestRecord;
  };
};
