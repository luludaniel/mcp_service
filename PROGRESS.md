# 진행상황

이 문서는 저장소 감사(2026-07-30) 이후 진행된 작업과 현재 상태를 추적합니다.
초기 목표 구조 대비 차이 분석은 `todolist.md`를 참고하세요.

## 완료

### 1순위 — korean-law 실 연동 완성 ✅ (2026-07-30)

- **문제**: `.env`의 `LEGAL_PROVIDER`, `LAW_OC`가 비어 있어 모든 응답이 하드코딩된
  mock 데이터(`민법 제390조`, `제750조` 고정값)였음.
- **작업**:
  - `korean-law` CLI(v4.0.7)를 라이브 호출해 실제 계약을 확인. 도구 하위 명령은
    JSON이 아닌 텍스트를 출력하며, 자연어 질문은 `search_law`가 아니라
    `query --json`(`chain_full_research`)으로 라우팅해야 함을 발견.
  - `src/services/koreanLawParser.service.ts` 신규 작성 — CLI 텍스트를 인용
    검증기가 쓰는 구조화 데이터로 변환. 실제 응답을 `src/services/fixtures/`에
    고정해 회귀 테스트로 검증(파서 테스트 20개).
  - `mcpLegal.service.ts`에 `researchAuthorities(question)` 경로 추가, 3개
    워크플로가 자연어 질문을 올바른 CLI 경로로 보내도록 변경.
  - **보안 수정**: 판례 결과의 `링크:` 필드에 포함된 API 키(`OC=...`)가 응답에
    그대로 노출되던 문제를 발견해 `redactApiKey`로 마스킹 처리.
  - **버그 수정**: `[전문개정 ...]` 개정 주석이 들여쓰기 없이 시작해 법령명으로
    오인되던 파싱 버그를 라이브 테스트 중 발견 및 수정.
- **검증**:
  - `npm test`: 25 → 47개 테스트, 전부 통과
  - 실제 API 키로 3개 워크플로 HTTP 엔드포인트를 직접 호출 —
    `citationVerification.sourceSufficiency`가 `insufficient` → `sufficient`/`partial`로 개선
  - 브라우저 개발자도구 없이 응답 본문 직접 검사로 API 키 미노출 확인(코드 리뷰 수준)
- **상태**: PR #1로 제출, 저장소 소유자 검토 대기 중.
  https://github.com/luludaniel/mcp_service/pull/1

### 사용자 테스트 (UAT) ✅ 실행 완료 (2026-07-31)

- `USER_TESTING.md`의 8개 케이스를 브라우저(Chrome, 실제 UI 클릭/입력)로 전부 실행.
- **안전장치는 전부 통과**: TC-4(`LAW_OC` 없을 때 안전 축소), TC-6(API 키 미노출)은
  기대대로 완벽히 동작. 환각(지어낸 법령/조문)도 어떤 케이스에서도 발견되지 않음.
- **새로 발견한 이슈 4건** (전부 `USER_TESTING.md`에 재현 절차 포함 기록):
  - **이슈 #1 (High)**: 자연어 전체 문장으로 질의하면 `sourceSufficiency`가
    `sufficient`/`partial`로 나오면서 실제로는 질문과 무관한 법령/판례를 근거로
    제시함 (예: "프리랜서 용역대금 미지급" 질문에 "해양수산부 직제 시행규칙"이
    근거로 표시됨). 환각은 아니지만 "출처가 충분하다"는 잘못된 신호를 줄 수 있어
    법률 서비스 관점에서 가장 우선 검토가 필요함. korean-law CLI의 폴백 검색
    동작이 원인이며, PR #1의 파서/보안 수정과는 별개 문제.
  - **이슈 #2 (Low)**: 워크플로 요약 텍스트("현재는 개발용 검색 결과를...")가
    provider와 무관하게 하드코딩되어 있어 실제 provider를 써도 mock 문구가 노출됨.
  - **이슈 #3 (Medium)**: 계약서 검토/문서 초안 UI에 세부 입력 필드(당사자 지위,
    문서 유형 등)가 없어 항상 고정 기본값이 전송됨. PR #1이 만든 문제는 아니고
    기존 MVP UI의 설계 범위 밖.
  - **이슈 #4 (Info)**: 응답 지연(2~3초) 시 로딩 피드백이 버튼 텍스트 변경뿐이라 약함.
- **결론**: 안전장치는 검증됐으나 **이슈 #1(근거 관련성 문제)은 머지 전 판단이
  필요**. 저장소 소유자가 PR #1을 그대로 머지하고 이슈 #1을 후속 작업으로
  돌릴지, 머지를 보류하고 먼저 고칠지 결정해야 함.

## 다음 순위 (미착수)

### 1.5순위 — UAT에서 발견된 이슈 #1 처리 (머지 전 판단 필요)

- 자연어 전체 문장 질의 시 무관한 법령/판례가 근거로 제시되는 문제. 상세 내용과
  재현 절차는 `USER_TESTING.md`의 "이슈 #1" 참고.
- 후보 방향: (a) CLI에 넘기기 전 질문에서 핵심 키워드만 추출, (b) 인용 검증기가
  결과의 관련성까지 판정하도록 확장, (c) 우선 문서화만 하고 다음 반복에서 처리.
  결정은 저장소 소유자 몫.

### 2순위 — YAML 평가 러너 연결

- `legal-harness/evals/*.yaml` 3개 파일이 작성되어 있으나 코드에서 실행되지 않음.
- 계획: YAML을 읽어 워크플로를 실제 호출하고 `must_include`/`must_not_include`를
  검증하는 러너를 만들어 `npm test`에 연결.

### 3순위 — harness 디렉토리 정리

- `harness/*.json`(6개 파일)과 `src/harness.ts`가 같은 내용을 이중 관리 중.
- `legal-harness/prompts/`, `legal-harness/outputs/{reports,checklists,drafts}/`는
  빈 폴더로 남아 있음.

### 4순위 — LLM 도입 여부 결정 (사용자 판단 필요)

- 현재 "워크플로"는 키워드 매칭(`legalWorkflow.service.ts`)이며 실제 LLM 호출이
  전혀 없음. `package.json`에 anthropic/openai 등 의존성 없음.
- `analyze_document`, `chain_document_review` 등 계약서 검토에 적합한 korean-law
  CLI 도구(80개 이상 도구 중)가 아직 활용되지 않음.

## 참고 링크

- PR: https://github.com/luludaniel/mcp_service/pull/1
- 테스트 케이스: `USER_TESTING.md`
- 초기 구상 대비 차이 분석: `todolist.md`
