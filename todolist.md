# 법률 하네스 작업 목록

이 문서는 초기 `/legal-harness` 목표 구조와 현재 구현을 비교하고, 빠진 항목과 다음 작업 후보를 정리합니다.

## 현재 구현 요약

현재 저장소는 TypeScript 백엔드, React 프론트엔드, JSON 하네스 메타데이터로 구성되어 있습니다.

구현된 영역:

- Express 백엔드 API
  - `src/server.ts`
  - `src/app.ts`
- 워크플로 계층
  - `src/workflows/legalResearch.workflow.ts`
  - `src/workflows/contractReview.workflow.ts`
  - `src/workflows/documentDraft.workflow.ts`
- 서비스 계층
  - `src/services/mcpLegal.service.ts`
  - `src/services/safetyFilter.service.ts`
  - `src/services/citationVerifier.service.ts`
  - `src/services/legalWorkflow.service.ts`
- 하네스 메타데이터
  - `src/harness.ts` — 워크플로/정책 정의의 단일 소스(정적 JSON 사본은 2026-08-01에 제거,
    아래 "3순위" 참고)
  - `harness/evals/general-legal-service.json`, `harness/evals/safety-and-citation.json`
  - `legal-harness/evals/*.yaml`
- React 최소 기능 UI
  - `web/src/App.tsx`
  - `web/src/App.css`
  - `web/src/index.css`

## 초기 목표 구조

```text
/legal-harness
  /mcp_servers
    korean_law_mcp
    document_reader_mcp
  /agents
    issue_classifier.py
    law_retriever.py
    precedent_retriever.py
    legal_summarizer.py
    risk_checker.py
    draft_writer.py
  /prompts
    legal_search.prompt
    precedent_summary.prompt
    contract_review.prompt
    school_policy_review.prompt
  /evals
    citation_required_tests.yaml
    hallucination_tests.yaml
    outdated_law_tests.yaml
  /outputs
    reports
    checklists
    drafts
```

## 차이 분석

### `/legal-harness`

상태: 없음.

현재 대응 구조:

- `src/`는 실행 가능한 백엔드 코드를 포함하며, `src/harness.ts`가 워크플로/정책 정의의
  단일 소스입니다.
- `harness/evals/`는 하네스 정의 자체를 검증하는 평가 시나리오 JSON을 포함합니다
  (워크플로/정책 JSON 사본은 2026-08-01에 중복 제거, "3순위" 참고).

결정 필요:

- 현재 `src/`와 `harness/` 구조를 유지할지
- `/legal-harness`를 별도 산출물 계층으로 추가할지

추천 작업:

- 먼저 `/legal-harness`를 런타임과 분리된 문서/산출물 계층으로 추가합니다.
- TypeScript 런타임 코드는 산출물 구조가 안정될 때까지 이동하지 않습니다.

### `/legal-harness/mcp_servers/korean_law_mcp`

상태: 완료 (2026-07-30, PR #1).

현재 대응 구조:

- `src/services/mcpLegal.service.ts`가 다음을 지원합니다.
  - `LEGAL_PROVIDER=mock`
  - `LEGAL_PROVIDER=korean-law`
  - `LAW_OC`
  - `searchLaw(query)`
  - `searchPrecedents(query)`
  - `getLawArticle(lawName, articleNo)`
  - `researchAuthorities(question)` — 자연어 질문을 `query --json`(`chain_full_research`)로 라우팅
- `src/services/koreanLawParser.service.ts`가 CLI 텍스트 출력을 구조화된 인용
  데이터로 변환합니다. 실제 CLI 응답을 `src/services/fixtures/`에 고정해
  회귀 테스트로 검증합니다.
- `legal-harness/mcp_servers/korean_law_mcp/README.md`에 검증된 CLI 계약(출력
  형식, 자연어 질문 라우팅 규칙, 실패 표기, API 키 노출 주의)을 문서화했습니다.

완료된 항목:

- `/legal-harness/mcp_servers/korean_law_mcp/README.md` 추가 및 검증된 CLI 계약 반영.
- 실제 `LAW_OC` 키로 live CLI 호출 검증 완료. 자연어 질문을 `search_law`에 그대로
  넘기면 법제처 API의 AND 키워드 검색 특성상 거의 항상 실패한다는 것을 확인하고
  `query --json` 경로로 전환.
- 판례 결과의 `링크:` 필드에 포함된 API 키(`OC=...`) 노출 문제를 발견해 마스킹 처리.

남은 항목: `USER_TESTING.md` 기준 사람에 의한 UI 수동 검증 (`PROGRESS.md` 참고).

### `/legal-harness/mcp_servers/document_reader_mcp`

상태: 없음.

현재 대응 구조:

- 없음.

빠진 항목:

- 문서 읽기 인터페이스
- 계약서/문서 파싱 제공자
- 파일 업로드 또는 텍스트 추출 전략

결정됨 (2026-08-01): 붙여넣은 텍스트부터 지원. 파일 업로드/파싱/보안 검토가 필요한
PDF·DOCX는 별도 규모의 작업이라 필요해지면 나중에 확장.

다음 작업:

- 지금은 계약서 검토·문서 초안 입력이 이미 `contractText`/`facts` 같은 일반 텍스트
  필드로 들어오고 있어 별도 어댑터 없이도 이 결정이 충족된 상태. 실제
  `document_reader_mcp` 모듈이 필요해지는 시점은 PDF/DOCX 지원을 시작할 때(미착수).

### `/legal-harness/agents/*.py`

상태: Python agent 파일은 없음.

현재 TypeScript 대응 구조:

- `issue_classifier.py`
  - 워크플로 라우팅과 `legalWorkflow.service.ts`가 일부 역할을 수행합니다.
- `law_retriever.py`
  - `mcpLegal.service.ts`가 일부 역할을 수행합니다.
- `precedent_retriever.py`
  - `mcpLegal.service.ts`가 일부 역할을 수행합니다.
- `risk_checker.py`
  - `safetyFilter.service.ts`와 `citationVerifier.service.ts`가 일부 역할을 수행합니다.
- `draft_writer.py`
  - `documentDraft.workflow.ts`가 일부 역할을 수행합니다.
- `legal_summarizer.py`
  - 독립 모듈로는 아직 구현되지 않았습니다.

결정됨 (2026-08-01): TypeScript agent로 진행. 새 런타임/프로세스 간 통신 복잡도를
추가할 이유가 없다고 판단.

다음 작업:

- 역할 분리가 실제로 필요해질 때 `src/agents/`를 추가합니다(지금은 아직 그 시점이
  아니라고 판단, 미착수).
- 명확한 오케스트레이션 요구가 없다면 Python 런타임은 도입하지 않습니다.

### `/legal-harness/prompts/*.prompt`

상태: 완료 (2026-08-01).

현재 대응 구조:

- `legal-harness/prompts/legal_search.prompt`, `precedent_summary.prompt`,
  `contract_review.prompt`, `education_context_exclusion.prompt` 4개 파일 작성 완료.
- `school_policy_review.prompt`는 만들지 않고 `education_context_exclusion.prompt`로
  대체(결정 사유는 위 "사용자 결정 사항" 참고).
- 각 파일 상단에 실제 코드와의 연결 상태(이미 연결/부분 연결/미연결)와 진짜 소스가
  어디인지 명시해, `harness/policies`·`harness/workflows` JSON처럼 코드와 조용히
  어긋나는 문제가 재발하지 않도록 함. `education_context_exclusion.prompt`만 이미
  실행 중인 코드(`hasExcludedEducationContext`)를 문서화한 것이고, 나머지 3개는
  아직 코드에서 읽지 않는 설계 문서(LLM 확장 결정 시 사용).
- `src/prompts/` 폴더는 여전히 비어 있음(런타임에서 읽는 코드가 없어 그대로 둠).

### `/legal-harness/evals/*.yaml`

상태: 완료 (2026-08-01).

현재 대응 구조:

- `legal-harness/evals/citation_required_tests.yaml`, `hallucination_tests.yaml`,
  `outdated_law_tests.yaml` 3개 파일 작성 완료.
- `src/harnessEval.test.ts`가 위 YAML을 읽어 실제 HTTP 엔드포인트를 호출하고
  `must_include`/`must_not_include`/`fallback_must_include`를 검증. `vitest run`(=`npm test`)에
  자동 포함됨.
- `harness/evals/general-legal-service.json`, 기존 Vitest 서비스/API 테스트(인용 검증, 안전
  필터, MCP 제공자, API)와 함께 유지.

세부 내용은 `PROGRESS.md`의 "2순위 — YAML 평가 러너 연결" 항목 참고(실제 실행해서 발견한
YAML 기대값과 실제 응답 간 불일치 3건과 수정 내역 포함).

### `/legal-harness/outputs/reports`

상태: 없음.

현재 대응 구조:

- React UI가 리포트 카드를 렌더링합니다.
- API는 구조화된 JSON을 반환합니다.

빠진 항목:

- 저장된 리포트 예시
- 리포트 템플릿 형식

완료 (2026-08-01): 정적 예시만 둔다 — 백엔드는 계속 무상태(stateless)로 유지하고
실제 파일 저장 기능은 추가하지 않음. `legal-research-report-example.json`,
`contract-review-report-example.json` 작성 완료 — 손으로 지어낸 내용이 아니라
실제 워크플로 함수를 직접 호출해 캡처한 진짜 응답을 그대로 저장.

### `/legal-harness/outputs/checklists`

상태: 없음.

현재 대응 구조:

- 워크플로 출력에 `nextSteps`가 포함됩니다.

빠진 항목:

- 저장된 체크리스트 예시
- 체크리스트 템플릿 형식

완료 (2026-08-01): 정적 예시만 둔다(위 "outputs/reports" 결정과 동일).
`legal-research-checklist-example.md`, `contract-review-checklist-example.md`,
`document-draft-checklist-example.md` 작성 완료 — 실제 API 응답의 `nextSteps`/
`policy.warnings` 필드를 그대로 옮김.

### `/legal-harness/outputs/drafts`

상태: 없음.

현재 대응 구조:

- 문서 초안 워크플로가 초안 메타데이터와 mock 섹션을 반환합니다.

빠진 항목:

- 저장된 초안 예시
- 초안 출력 템플릿 형식

완료 (2026-08-01): 정적 예시만 둔다(위 "outputs/reports" 결정과 동일).
`document-draft-example.md` 작성 완료 — 실제 `mockResult.sections`/`placeholders`
구조를 사람이 읽는 문서 형태로 채워 넣되, 확인되지 않은 정보(정확한 금액, 작성일,
첨부자료)는 지어내지 않고 자리표시자로 남김. 상단에 초안 전용 경고 문구 명시.

## 추천 다음 작업 계획

### 1단계: 산출물 구조 추가

생성 대상:

```text
legal-harness/
  mcp_servers/
  prompts/
  evals/
  outputs/
    reports/
    checklists/
    drafts/
```

목적:

- 현재 동작하는 TypeScript 앱은 유지합니다.
- 초기 하네스 산출물 구조를 런타임 코드와 충돌 없이 추가합니다.

### 2단계: prompt 파일 추가 — 완료 (2026-08-01)

```text
legal-harness/prompts/legal_search.prompt
legal-harness/prompts/precedent_summary.prompt
legal-harness/prompts/contract_review.prompt
legal-harness/prompts/education_context_exclusion.prompt
```

`school_policy_review.prompt`는 만들지 않았습니다(제품 범위 제외 대상).

### 3단계: YAML 평가 명세 추가

생성 대상:

```text
legal-harness/evals/citation_required_tests.yaml
legal-harness/evals/hallucination_tests.yaml
legal-harness/evals/outdated_law_tests.yaml
```

목적:

- 인용, 환각 방지, 최신 법령 확인 기준을 명확히 합니다.

### 4단계: 산출물 예시 추가 — 완료 (2026-08-01)

```text
legal-harness/outputs/reports/legal-research-report-example.json
legal-harness/outputs/reports/contract-review-report-example.json
legal-harness/outputs/checklists/legal-research-checklist-example.md
legal-harness/outputs/checklists/contract-review-checklist-example.md
legal-harness/outputs/checklists/document-draft-checklist-example.md
legal-harness/outputs/drafts/document-draft-example.md
```

전부 실제 워크플로 함수를 직접 호출해 캡처한 진짜 응답 기반(손으로 지어낸 예시
아님). 백엔드가 이 파일들을 생성/저장하지는 않습니다 — 정적 예시로만 존재.

### 5단계: agent 구조 결정 — 완료 (2026-08-01)

TypeScript agent로 결정. `src/agents/`는 역할 분리가 실제로 필요해지는 시점에 추가(미착수).

## 사용자 결정 사항 — 전부 결정 완료 (2026-08-01)

1. ✅ 현재 `src/` 런타임 구조를 유지한 채 `/legal-harness`를 evals·MCP 문서용 보조
   계층으로 둔다. (`README.md`의 "저장소 구조" 절 참고)
2. ✅ agent는 TypeScript로 만든다. 실제 구현은 역할 분리가 필요해질 때(미착수).
3. ✅ `document_reader_mcp`는 붙여넣은 텍스트부터 지원한다. PDF/DOCX는 별도 작업으로
   미룬다(미착수).
4. ✅ `school_policy_review.prompt`는 만들지 않고 `education_context_exclusion.prompt`로
   대체한다(파일 작성은 미착수, 2단계 참고).
5. ✅ sample output은 정적 예시만 둔다. 백엔드에 파일 저장 기능은 추가하지 않는다
   (예시 파일 작성은 미착수, 4단계 참고).

결정은 끝났지만 실제 산출물(prompt 4개, outputs 예시)은 아직 작성되지 않았습니다 —
착수 여부는 별도로 판단.
