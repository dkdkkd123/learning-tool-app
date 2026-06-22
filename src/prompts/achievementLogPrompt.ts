import type { StudyProject, TestRecord, ProjectEvent, KnowledgeNode } from '../domain/types';

export const ACHIEVEMENT_LOG_SYSTEM_PROMPT = `당신은 학습 성과 분석 전문가입니다. JSON만 출력한다. 마크다운 코드 블록을 사용하지 않는다.

학습자의 프로젝트 이력을 바탕으로 성찰적 성취 기록을 생성합니다.

포함 내용:
1. 학습 여정 요약
2. 주요 개념 숙달 현황
3. 발견된 오개념과 극복 과정
4. 다음 학습 방향 제안

응답 형식:
{
  "title": "성취 기록 제목",
  "summary": "전체 학습 여정 요약 (3-5문장)",
  "masteredConcepts": ["개념1", "개념2"],
  "challengingConcepts": ["어려웠던 개념1"],
  "misconceptionsOvercome": ["극복한 오개념1"],
  "keyInsights": ["핵심 인사이트1", "핵심 인사이트2"],
  "nextSuggestions": ["다음 학습 제안1", "다음 학습 제안2"],
  "reflectionText": "전체 학습 여정에 대한 성찰 글 (마크다운 형식, 500-1000자)"
}`;

export function buildAchievementLogUserPrompt(
  project: StudyProject,
  testRecords: TestRecord[],
  events: ProjectEvent[],
  completedNodes: KnowledgeNode[]
): string {
  const activeCapstone = project.capstones.find((c) => c.id === project.activeCapstoneId);

  const lines: string[] = [];
  lines.push(`프로젝트: ${project.title}`);
  lines.push(`원본 입력: ${project.originalInput}`);
  if (activeCapstone) {
    lines.push(`캡스톤: ${activeCapstone.title}`);
    lines.push(`성공 기준: ${activeCapstone.successCriteria}`);
    lines.push(`캡스톤 상태: ${activeCapstone.status}`);
  }

  lines.push(`\n완료된 노드 (${completedNodes.length}개):`);
  for (const node of completedNodes) {
    lines.push(`- ${node.name}`);
  }

  lines.push(`\n테스트 기록 (${testRecords.length}개):`);
  for (const record of testRecords.slice(-10)) {
    const node = project.nodes[record.nodeId];
    lines.push(
      `- ${node?.name ?? record.nodeId}: ${record.difficulty} 난이도, ${record.summary.overallVerdict} (${record.summary.passCount}/${record.summary.totalCount})`
    );
    if (record.summary.misconceptions.length > 0) {
      lines.push(`  오개념: ${record.summary.misconceptions.join(', ')}`);
    }
  }

  lines.push(`\n프로젝트 이벤트 (최근 10개):`);
  for (const event of events.slice(-10)) {
    lines.push(`- [v${event.graphVersion}] ${event.summary}`);
  }

  lines.push('\n위 정보를 바탕으로 성찰적 성취 기록을 생성해주세요.');
  return lines.join('\n');
}
