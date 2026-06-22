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
  ModelProvider,
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
// Provider config
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<ModelProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
};

// ---------------------------------------------------------------------------
// Low-level call helpers
// ---------------------------------------------------------------------------

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: MODEL_MAP.anthropic,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Anthropic response type');
  return block.text;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.');
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.chat.completions.create({
    model: MODEL_MAP.openai,
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
  provider: ModelProvider,
): Promise<string> {
  return provider === 'anthropic'
    ? callAnthropic(systemPrompt, userPrompt)
    : callOpenAI(systemPrompt, userPrompt);
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
  provider: ModelProvider,
  transform: (raw: string) => T,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLLM(systemPrompt, userPrompt, provider);
      return transform(raw);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`LLM call attempt ${attempt + 1} failed:`, lastError.message);
    }
  }
  throw lastError ?? new Error('LLM call failed');
}

// ---------------------------------------------------------------------------
// Public API — all functions accept provider as last param
// ---------------------------------------------------------------------------

export async function proposeCapstones(
  input: string,
  mode: 'learning_content' | 'capstone',
  provider: ModelProvider,
  preferences?: {
    outputType?: string;
    difficulty?: string;
    knownKnowledge?: string;
    excludedScope?: string;
  },
): Promise<CapstoneCandidate[]> {
  const userPrompt = buildCapstoneUserPrompt(input, mode, preferences);
  return callWithRetry(CAPSTONE_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
    const data = parseJSON<{ capstoneCandidates: CapstoneCandidate[] }>(raw);
    return data.capstoneCandidates;
  });
}

export async function generateDagDraft(
  capstone: CapstoneNode,
  provider: ModelProvider,
  knownKnowledge?: string,
  excludedScope?: string,
): Promise<{ nodes: Record<string, KnowledgeNode>; edges: Edge[] }> {
  const userPrompt = buildDagUserPrompt(capstone, knownKnowledge, excludedScope);
  return callWithRetry(DAG_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
    type RawNode = {
      tempId: string;
      name: string;
      summary: string;
      prerequisiteTempIds: string[];
    };
    const data = parseJSON<{ nodes: RawNode[]; capstonePrerequisiteTempIds?: string[] }>(raw);
    const now = new Date().toISOString();

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
        createdAt: now,
        updatedAt: now,
      };

      for (const preId of prerequisiteNodeIds) {
        if (!edges.some((e) => e.from === preId && e.to === id)) {
          edges.push({ from: preId, to: id });
        }
      }
    }

    // Connect specified capstone prerequisite nodes → capstone
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
      // Fallback: connect leaf knowledge nodes (no knowledge-node successors) to capstone
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
  provider: ModelProvider,
): Promise<TestGoal> {
  const userPrompt = buildTestGoalUserPrompt(node, capstoneContext);
  return callWithRetry(TEST_GOAL_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
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
  provider: ModelProvider,
  pastRecords?: TestRecord[],
): Promise<{ exam: ExamDocument; answerKey: AnswerKey }> {
  const pastSummary = pastRecords
    ?.map(
      (r) =>
        `${r.difficulty}: ${r.summary.overallVerdict} (${r.summary.passCount}/${r.summary.totalCount})`,
    )
    .join(', ');

  const userPrompt = buildExamUserPrompt(testGoal, node, difficulty, pastSummary);
  return callWithRetry(EXAM_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
    return parseJSON<{ exam: ExamDocument; answerKey: AnswerKey }>(raw);
  });
}

export async function gradeExam(
  exam: ExamDocument,
  answerKey: AnswerKey,
  submittedAnswers: Record<string, string>,
  testGoal: TestGoal,
  provider: ModelProvider,
): Promise<{
  results: QuestionResult[];
  summary: TestRecord['summary'];
}> {
  const userPrompt = buildGradingUserPrompt(exam, answerKey, submittedAnswers, testGoal.completionRule);
  return callWithRetry(GRADING_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
    return parseJSON<{
      results: QuestionResult[];
      summary: TestRecord['summary'];
    }>(raw);
  });
}

export async function generateGraphPatch(
  project: StudyProject,
  userInstruction: string,
  provider: ModelProvider,
): Promise<GraphPatch> {
  const userPrompt = buildGraphPatchUserPrompt(project, userInstruction);
  return callWithRetry(GRAPH_PATCH_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
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
  provider: ModelProvider,
): Promise<string> {
  return callLLM(systemPrompt, userPrompt, provider);
}

export async function chatCompletion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  provider: ModelProvider,
): Promise<string> {
  if (provider === 'anthropic') {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.messages.create({
      model: MODEL_MAP.anthropic,
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
      model: MODEL_MAP.openai,
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
  provider: ModelProvider,
): Promise<AchievementLog> {
  const userPrompt = buildAchievementLogUserPrompt(project, testRecords, events, completedNodes);
  return callWithRetry(ACHIEVEMENT_LOG_SYSTEM_PROMPT, userPrompt, provider, (raw) => {
    return parseJSON<AchievementLog>(raw);
  });
}
