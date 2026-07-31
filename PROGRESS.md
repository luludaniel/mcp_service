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
- **결론**: 안전장치는 검증됨.

### 이슈 #1 조치 ✅ (2026-07-31, 같은 날 처리)

- **조사**: `route.reason`이 관련성 신호일 거라 가정했으나 반증 발견 — 정확한 결과와
  무관한 결과가 똑같이 `"패턴 미매칭"`으로 나옴. CLI 메타데이터만으로는 신뢰도 판별 불가.
- **(A) 질의 사전 정제**: `src/services/koreanQueryKeywords.service.ts`에
  `extractSearchKeywords()` 추가 — 자연어 문장에서 조사/의문형 어미 제거. 라이브 검증
  결과 `route.reason`은 개선되지만 반환 법령 자체는 여전히 무관한 경우가 있어 **단독으로는
  불충분**함을 실증.
- **(B) 사후 관련성 필터**: 같은 파일에 `filterByRelevance()` 추가 — 질문 토큰과 반환
  결과 사이 단어 겹침이 전혀 없으면 제외. 겹침 0건이면 배열이 비어 기존
  `citationVerifier.service.ts`(수정 없음)가 자동으로 "출처 부족"으로 판정 — 새 판정
  로직 없이 기존 안전장치를 재사용하는 설계.
- **`mcpLegal.service.ts`의 `researchAuthorities()`에 통합**: CLI에 보내는 질의를
  정제된 키워드로 교체하고, 반환된 법령/판례에 관련성 필터를 적용.
- **결과**: TC-5(무의미 질의)는 10건 무관 결과 → 0건, `sufficiency: sufficient` →
  `insufficient`로 완전히 해결. TC-1(전체 문장)은 10건 → 2건으로 크게 개선,
  `sufficient` → `partial`로 격하되고 "관련성 낮은 결과 제외" 경고가 붙지만, "조치"
  같은 매우 일반적인 단어가 우연히 겹치는 잔여 사례는 남음(알려진 한계, 완벽한 의미
  기반 판단은 4순위 LLM 도입 결정으로 위임). TC-2/TC-4/TC-6는 회귀 없음을 라이브로 재확인.
- **검증**: vitest 12개 신규 테스트, 전체 47 → 59개 통과. 상세 내용은
  `USER_TESTING.md`의 "이슈 #1" 항목 참고.

### 이슈 #2, #3 조치 ✅ (2026-07-31, 같은 날 처리)

- **이슈 #2(요약 mock 문구 고정)**: `workflowCompliance.service.ts`에
  `describeAuthoritySource(provider)` 헬퍼 추가 — `legalResearch.workflow.ts`,
  `contractReview.workflow.ts`의 `summary`가 실제 provider("한국 법령 검색 제공자" vs
  "개발용 모의 검색 결과")를 반영하도록 수정. `documentDraft.workflow.ts`는 원래 mock
  문구가 없어 대상 아님. "한계" 카드(`mockResult.limitations`)의 "개발용 모의 검색" 문구는
  별개 필드(항상 규칙 기반인 `mockResult`에 대한 정확한 설명)라 버그가 아니라고 판단해
  손대지 않음.
- **이슈 #3(UI 세부 입력 필드 누락)**: `web/src/App.tsx`에 `extraFields` 개념을 추가해
  "계약서 검토" 탭에 당사자 지위/검토 관심사항, "문서 초안" 탭에 문서 유형/수신인/요청 결과
  입력창을 신설. 비워두면 기존과 동일한 기본값이 전송되어 회귀 없음.
- **검증**: 백엔드/프론트엔드 `npm run build` 통과, vitest 59 → 61개 통과. 브라우저로
  "당사자 지위: 을", "문서 유형: 내용증명" 등이 실제로 리포트에 반영되는 것을 라이브 확인.
  TC-2/TC-4/TC-5/TC-6 재검증으로 회귀 없음 확인. 상세 내용은 `USER_TESTING.md`의
  "이슈 #2", "이슈 #3" 항목 참고.

## 다음 순위 (미착수)

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
