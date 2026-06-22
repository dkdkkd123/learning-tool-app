# Docs Manifest

Status: Active
Current Version: v2.1.0
Latest Major Snapshot: v2.0.0
Last Updated: 2026-06-22

이 문서는 학습 도구 앱 기획 문서 시스템의 장부다. 현재 설계는 `docs/current/`에 있고, major 버전 스냅샷은 `docs/releases/`에 있으며, minor/patch 변경의 증분 기록은 `docs/changes/`에 둔다.

---

## Version Policy

버전은 `vMAJOR.MINOR.PATCH` 형식을 따른다.

| 구분 | 의미 | 기록 방식 |
|---|---|---|
| MAJOR | 문서 체계, 핵심 도메인 모델, 앱의 중심 구조가 호환 불가능하게 바뀜 | 전체 문서를 `docs/releases/vX.0.0/`에 복제 기록 |
| MINOR | 의미 있는 기능, UX, LLM 계약, 저장소, 구현 정책이 추가·변경됨 | `docs/changes/vX/`에 증분 변경 기록 |
| PATCH | 오타, 설명 보강, 작은 규칙 보정, 필드명 정정 | 필요한 경우 `docs/changes/vX/`에 증분 변경 기록 |

현재 본문 문서는 항상 최신 상태만 유지한다. 과거 맥락은 `changes/`와 `releases/`에서 확인한다.

---

## Active Documents

| 문서 | 역할 | 상태 | 소유 정보 |
|---|---|---|---|
| `00-index.md` | 읽기 안내서 | Active | 문서 읽는 순서, 전체 지도 |
| `01-product-flow.md` | 제품 흐름 | Active | 서비스 로직, 사용자 여정, 캡스톤 중심 흐름 |
| `02-domain-model.md` | 도메인 모델 | Stable | StudyProject, Capstone, KnowledgeNode, Edge, TestGoal, GraphPatch |
| `03-llm-orchestration.md` | LLM 계약 | Draft | 호출 지점, 입력/출력 JSON, 프롬프트 운영 원칙 |
| `04-ux-spec.md` | UX 설계 | Draft | 화면 구성, 무한캔버스 DAG, 조작 패널, 테스트 화면 |
| `05-architecture.md` | 기술 아키텍처 | Draft | reducer, validation, storage, event log, canvas state |
| `06-implementation-plan.md` | 구현 계획 | Draft | MVP 범위, 구현 순서, 후속 단계, 미결정 사항 |

---

## Version Map

| 버전 | 기록 위치 | 설명 |
|---|---|---|
| v2.0.0 | `docs/releases/v2.0.0/` | 최초 분리 문서 스냅샷. DAG 시각화는 카드/리스트 중심 MVP로 정의됨 |
| v2.1.0 | `docs/current/` + `docs/changes/v2/v2.1.0-infinite-canvas-dag.md` | DAG 시각화를 조작 패널과 분리된 무한캔버스로 변경 |

---

## Document Lifecycle

```text
Draft → Active → Stable → Deprecated → Archived
```

- `Draft`: 아직 자주 바뀌는 문서
- `Active`: 현재 설계의 일부로 사용되는 문서
- `Stable`: 다른 문서가 의존하는 기준 문서
- `Deprecated`: 대체 문서가 생겨 더 이상 수정하지 않는 문서
- `Archived`: 과거 참고용으로만 보관하는 문서

문서 추가·삭제·통합은 다음 기준으로 판단한다.

> 새 문서는 기존 문서와 변경 주기가 다를 때만 만든다.

두 문서가 항상 함께 수정된다면 통합한다. 한 문서 안에서 특정 섹션만 유독 자주 바뀐다면 분리한다.

---

## Source Materials

이 문서 세트는 다음 원본을 기반으로 분리·재구성했다.

- `learning-scope-decomposition-skill-v2.md`
- `knowledge-understanding-test-skill-v3.md`
- `learning-tool-app-spec-v2.md`

앱 구현 시 원본 스킬 문서를 그대로 붙여 넣기보다, `03-llm-orchestration.md`의 앱용 JSON 계약과 `02-domain-model.md`의 도메인 모델에 맞춰 압축해 사용한다.
