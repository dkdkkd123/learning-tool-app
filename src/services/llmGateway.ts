import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import type {
  CapstoneCandidate,
  CapstoneNode,
  KnowledgeNode,
  Edge,
  TestGoal,
  ExamDocument,
  AnswerKey,
  QuestionResult,
  TestRecord,
  GraphPatch,
  StudyProject,
  ModelConfig,
} from '../domain/types';
import {
  CAPSTONE_SYSTEM_PROMPT,
  buildCapstoneUserPrompt,
} from '../prompts/capstonePrompt';
import { DAG_SYSTEM_PROMPT, buildDagUserPrompt } from '../prompts/dagPrompt';
import {
  GRAPH_PATCH_SYSTEM_PROMPT,
  buildGraphPatchUserPrompt,
} from '../prompts/graphPatchPrompt';
import {
  TEST_GOAL_SYSTEM_PROMPT,
  buildTestGoalUserPrompt,
  EXAM_SYSTEM_PROMPT,
  buildExamUserPrompt,
  GRADING_SYSTEM_PROMPT,
  buildGradingUserPrompt,
} from '../prompts/testPrompt';
import {
  ACHIEVEMENT_LOG_SYSTEM_PROMPT,
  buildAchievementLogUserPrompt,
} from '../prompts/achievementLogPrompt';

// ---------------------------------------------------------------------------
// Low-level call helpers
// ---------------------------------------------------------------------------

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  modelId: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Anthropic response type');
  return block.text;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  modelId: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.');
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.chat.completions.create({
    model: modelId,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  config: ModelConfig
): Promise<string> {
  return config.provider === 'anthropic'
    ? callAnthropic(systemPrompt, userPrompt, config.modelId)
    : callOpenAI(systemPrompt, userPrompt, config.modelId);
}

function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

async function callWithRetry<T>(
  systemPrompt: string,
  userPrompt: string,
  config: ModelConfig,
  transform: (raw: string) => T
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLLM(systemPrompt, userPrompt, config);
      return transform(raw);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`LLM call attempt ${attempt + 1} failed:`, lastError.message);
    }
  }
  throw lastError ?? new Error('LLM call failed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function proposeCapstones(
  input: string,
  mode: 'learning_content' | 'capstone',
  config: ModelConfig,
  preferences?: {
    outputType?: string;
    difficulty?: string;
    knownKnowledge?: string;
    excludedScope?: string;
  }
): Promise<CapstoneCandidate[]> {
  const userPrompt = buildCapstoneUserPrompt(input, mode, preferences);
  return callWithRetry(CAPSTONE_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    const data = parseJSON<{ capstoneCandidates: CapstoneCandidate[] }>(raw);
    return data.capstoneCandidates;
  });
}

export async function generateDagDraft(
  capstone: CapstoneNode,
  config: ModelConfig,
  knownKnowledge?: string,
  excludedScope?: string
): Promise<{ nodes: Record<string, KnowledgeNode>; edges: Edge[] }> {
  const userPrompt = buildDagUserPrompt(capstone, knownKnowledge, excludedScope);
  return callWithRetry(DAG_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    type RawNode = {
      tempId: string;
      name: string;
      summary: string;
      prerequisiteTempIds: string[];
    };
    const data = parseJSON<{ nodes: RawNode[]; capstonePrerequisiteTempIds?: string[] }>(raw);
    const now2 = new Date().toISOString();

    const tempToReal: Record<string, string> = {};
    for (const rn of data.nodes) {
      tempToReal[rn.tempId] = nanoid();
    }

    const nodes: Record<string, KnowledgeNode> = {};
    const edges: Edge[] = [];

    for (const rn of data.nodes) {
      const id = tempToReal[rn.tempId];
      const prerequisiteNodeIds = (rn.prerequisiteTempIds ?? [])
        .map((tid) => tempToReal[tid])
        .filter(Boolean);

      nodes[id] = {
        id,
        kind: 'knowledge',
        name: rn.name,
        summary: rn.summary,
        prerequisiteNodeIds,
        status: 'waiting',
        testGoalStatus: 'none',
        notes: [],
        createdBy: 'llm',
        createdAt: now2,
        updatedAt: now2,
      };

      for (const preId of prerequisiteNodeIds) {
        if (!edges.some((e) => e.from === preId && e.to === id)) {
          edges.push({ from: preId, to: id });
        }
      }
    }

    const capstonePrereqs = (data.capstonePrerequisiteTempIds ?? [])
      .map((tid) => tempToReal[tid])
      .filter(Boolean);

    if (capstonePrereqs.length > 0) {
      for (const realId of capstonePrereqs) {
        if (!edges.some((e) => e.from === realId && e.to === capstone.id)) {
          edges.push({ from: realId, to: capstone.id });
        }
      }
    } else {
      const hasKnowledgeSuccessor = new Set<string>();
      for (const edge of edges) {
        if (nodes[edge.to]) hasKnowledgeSuccessor.add(edge.from);
      }
      for (const nodeId of Object.keys(nodes)) {
        if (!hasKnowledgeSuccessor.has(nodeId)) {
          edges.push({ from: nodeId, to: capstone.id });
        }
      }
    }

    return { nodes, edges };
  });
}

export async function generateTestGoal(
  node: KnowledgeNode,
  capstoneContext: CapstoneNode,
  config: ModelConfig
): Promise<TestGoal> {
  const userPrompt = buildTestGoalUserPrompt(node, capstoneContext);
  return callWithRetry(TEST_GOAL_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    type RawGoal = {
      topic: string;
      targetDescription: string;
      questionPlan: { type1: number; type2: number; type3: number; type4: number; type5: number };
      completionRule: { requiredOverallVerdict: 'pass'; requiredDifficulty: '초급' | '중급' | '고급' };
    };
    const data = parseJSON<RawGoal>(raw);
    const testGoal: TestGoal = {
      id: nanoid(),
      nodeId: node.id,
      graphVersionCreated: 1,
      topic: data.topic,
      targetDescription: data.targetDescription,
      difficultyPolicy: {
        initial: '초급',
        onPass: 'next_difficulty',
        onFail: 'same_difficulty',
        maxDifficultyForCompletion: data.completionRule.requiredDifficulty,
      },
      questionPlan: data.questionPlan,
      completionRule: data.completionRule,
      status: 'ready',
    };
    return testGoal;
  });
}

export async function generateExam(
  testGoal: TestGoal,
  node: KnowledgeNode,
  difficulty: '초급' | '중급' | '고급',
  config: ModelConfig,
  pastRecords?: TestRecord[]
): Promise<{ exam: ExamDocument; answerKey: AnswerKey }> {
  const pastSummary = pastRecords
    ?.map(
      (r) =>
        `${r.difficulty}: ${r.summary.overallVerdict} (${r.summary.passCount}/${r.summary.totalCount})`
    )
    .join(', ');

  const userPrompt = buildExamUserPrompt(testGoal, node, difficulty, pastSummary);
  return callWithRetry(EXAM_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    return parseJSON<{ exam: ExamDocument; answerKey: AnswerKey }>(raw);
  });
}

export async function gradeExam(
  exam: ExamDocument,
  answerKey: AnswerKey,
  submittedAnswers: Record<string, string>,
  testGoal: TestGoal,
  config: ModelConfig
): Promise<{
  results: QuestionResult[];
  summary: TestRecord['summary'];
}> {
  const userPrompt = buildGradingUserPrompt(exam, answerKey, submittedAnswers, testGoal.completionRule);
  return callWithRetry(GRADING_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    return parseJSON<{
      results: QuestionResult[];
      summary: TestRecord['summary'];
    }>(raw);
  });
}

export async function generateGraphPatch(
  project: StudyProject,
  userInstruction: string,
  config: ModelConfig,
  referencedNodeIds?: string[]
): Promise<GraphPatch> {
  const userPrompt = buildGraphPatchUserPrompt(project, userInstruction, referencedNodeIds);
  return callWithRetry(GRAPH_PATCH_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    return parseJSON<GraphPatch>(raw);
  });
}

export type AchievementLog = {
  title: string;
  summary: string;
  masteredConcepts: string[];
  challengingConcepts: string[];
  misconceptionsOvercome: string[];
  keyInsights: string[];
  nextSuggestions: string[];
  reflectionText: string;
};

export async function singleCall(
  systemPrompt: string,
  userPrompt: string,
  config: ModelConfig
): Promise<string> {
  return callLLM(systemPrompt, userPrompt, config);
}

export async function chatCompletion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  config: ModelConfig
): Promise<string> {
  if (config.provider === 'anthropic') {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: config.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  } else {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.');
    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.chat.completions.create({
      model: config.modelId,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

export async function generateAchievementLog(
  project: StudyProject,
  testRecords: TestRecord[],
  events: typeof project.events,
  completedNodes: KnowledgeNode[],
  config: ModelConfig
): Promise<AchievementLog> {
  const userPrompt = buildAchievementLogUserPrompt(project, testRecords, events, completedNodes);
  return callWithRetry(ACHIEVEMENT_LOG_SYSTEM_PROMPT, userPrompt, config, (raw) => {
    return parseJSON<AchievementLog>(raw);
  });
}
