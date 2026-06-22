# Learning Tool App Docs Index

Status: Active
Version: v2.0.0
Last Updated: 2026-06-22

이 문서 세트는 캡스톤 중심 학습 도구 앱의 기획·도메인·LLM 계약·UX·아키텍처·구현 계획을 의미 단위로 분리한 것이다.

---

## One-Sentence Product Definition

학습자가 학습 내용 또는 캡스톤 문제를 입력하면, 앱은 이진 성공 기준이 있는 캡스톤을 확정하고, 이를 달성하기 위한 지식 DAG를 역추적해 만들며, 각 지식 노드의 이해 테스트를 학습 목표로 삼아 학습·수정·성취 로그 출력을 지원한다.

---

## Reading Guide

| 목적 | 읽을 문서 |
|---|---|
| 앱이 무엇을 하는지 알고 싶다 | `01-product-flow.md` |
| 데이터 모델과 불변조건을 알고 싶다 | `02-domain-model.md` |
| LLM이 언제 호출되고 무엇을 반환하는지 알고 싶다 | `03-llm-orchestration.md` |
| 화면과 인터랙션을 구현하고 싶다 | `04-ux-spec.md` |
| reducer, storage, validation 구조를 구현하고 싶다 | `05-architecture.md` |
| MVP를 어떤 순서로 만들지 정하고 싶다 | `06-implementation-plan.md` |
| 버전과 문서 구조를 확인하고 싶다 | `00-manifest.md` |

---

## Core Design Commitments

1. 앱의 중심 객체는 학습 범위 문서가 아니라 `StudyProject`다.
2. 학습의 최종 목표는 이진 성공 기준이 있는 `CapstoneNode`다.
3. 캡스톤은 DAG의 리프 노드이며, 필요한 지식 노드를 선수로 가진다.
4. 지식 DAG는 중첩 트리가 아니라 노드와 간선으로 구성된 정규화 그래프다.
5. 각 지식 노드의 학습 목표는 지식 이해 테스트를 통과하는 것이다.
6. LLM은 상태를 직접 바꾸지 않고 `GraphPatch` 후보만 제안한다.
7. 앱은 schema validation, DAG validation, reducer를 통해 상태 변경을 적용한다.
8. DAG 시각화는 계층형 카드 리스트와 간단한 edge 표시를 우선한다.

---

## Current Version Summary

`v2.0.0`은 최초 분리 문서 스냅샷이다. DAG 시각화는 구현 안정성을 위해 카드 리스트 중심으로 정의한다.
