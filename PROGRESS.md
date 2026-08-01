# 진행상황

이 문서는 저장소 감사(2026-07-30) 이후 진행된 작업과 현재 상태를 추적합니다.
초기 목표 구조 대비 차이 분석은 `todolist.md`를 참고하세요.

## 완료

### codex_harness를 Claude Code CLI와 겸용 가능하게 확장 ✅ (2026-08-01)

- **배경**: 앞으로 Claude Code로 작업하기로 하면서, Codex CLI 전용으로 만들어뒀던
  `codex_harness/`(역할 기반 멀티 에이전트 하네스)를 계속 쓸 수 있는지 질문받음.
  삭제할지, 교차 사용 가능하게 만들지 결정이 필요했음.
- **조사**: `.agents/roles/*.md`, `.agents/workflows/*.md`, `project-checklist.md`,
  `scripts/{test,review}.sh`를 전부 확인한 결과 특정 CLI에 종속된 부분은
  `scripts/agent-runner.mjs`의 `spawnSync("codex", ["exec", ...])` 호출 하나뿐
  이었음 — 나머지는 순수 마크다운 프롬프트/셸 스크립트라 그대로 재사용 가능.
- **조치**: `agent-runner.mjs`가 `claude`/`codex` CLI를 자동 감지(`claude` 우선)
  하거나 `--tool`로 명시 지정하도록 수정. Codex의 `--sandbox
  read-only|workspace-write`를 Claude의 `--permission-mode`로 매핑
  (read-only 역할 → `plan`, 나머지 → `bypassPermissions`) — 다만 이 둘은 격리
  수준이 다른 별개 메커니즘이라는 점을 README에 명시. README/AGENTS.template.md/
  USAGE.md 갱신, 이미 Claude Code+OMC 세션 안에서는 이 스크립트 대신 `Agent`
  도구나 `/team`을 바로 쓸 수 있다는 점도 안내.
- **부수 정리**: `codex_harness/reports/current-project-review.md`(2026-06-12자,
  25개 테스트 시절 스냅샷 — 지금은 102개)는 이미 outdated된 실행 결과 리포트라
  복원하지 않고 정식 삭제. `.gitignore`의 `.omc/`가 빠져있어(이번에 처음
  `.omx/`를 오타로 오인해 지웠다가, 실제로는 2026-05-31자 세션 로그가 있는 별도
  디렉토리임을 확인하고 되돌림) `.omx/`와 `.omc/` 둘 다 무시하도록 수정.
- **검증**: `node --check`로 문법 확인, `--tool bogus`/미지원 workflow 인자
  검증 경로를 직접 실행해 에러 처리 확인. 실제 `claude`/`codex` 서브프로세스를
  띄우는 라이브 역할 실행은 이번 세션에서 검증하지 않음 — 다음 사용 시 라이브
  확인 권장(`USAGE.md`에 기록). `npm test` 전체 재실행 — 14개 파일, 102 passed +
  1 skipped, 프론트엔드 빌드 통과(회귀 없음).

### legal-harness/outputs 샘플 산출물 6개 작성 ✅ (2026-08-01)

- **범위**: "사용자 결정 사항 #5" 결정(정적 예시만, 백엔드 파일 저장 기능 없음)에 따라
  `legal-harness/outputs/{reports,checklists,drafts}`를 채움.
- **방법**: 내용을 손으로 지어내지 않고, `legalResearchWorkflow`/`contractReviewWorkflow`/
  `documentDraftWorkflow` 함수를 실제로 직접 호출해(README 예시와 동일한 입력 —
  프리랜서 용역대금 미지급 질문, 일방적 해지 계약 조항, 지급 요청서 초안 요청)
  캡처한 진짜 JSON 응답을 그대로 저장. 각 JSON 파일에 `_meta` 필드로 어떤 요청에서
  나왔는지, 손으로 쓴 게 아니라는 점을 명시.
  - `outputs/reports/{legal-research,contract-review}-report-example.json` — 워크플로
    응답 원본.
  - `outputs/checklists/{legal-research,contract-review,document-draft}-checklist-example.md`
    — 각 응답의 `nextSteps`/`policy.warnings`를 사람이 읽는 체크리스트로 재구성.
  - `outputs/drafts/document-draft-example.md` — `mockResult.sections`/`placeholders`를
    실제 문서 형태로 채움. 확인 안 된 정보(정확한 금액, 작성일, 첨부자료)는 이
    제품의 기존 원칙대로 지어내지 않고 대괄호 자리표시자로 남김, 상단에 초안 전용
    경고 명시.
- **검증**: JSON 파일 `JSON.parse` 유효성 확인, `npm test` 재실행 — 14개 파일, 102
  passed + 1 skipped, 프론트엔드 빌드 통과(문서 파일만 추가라 회귀 없음).
- **상태**: `todolist.md`의 초기 구상 산출물 구조(`legal-harness/{prompts,evals,outputs}`)
  전 항목이 이제 채워졌습니다.

### todolist.md 사용자 결정 사항 5가지 확정 + prompt 파일 4개 작성 ✅ (2026-08-01)

- **결정**: agent는 TypeScript로(새 런타임 도입 안 함), `document_reader_mcp`는 붙여넣은
  텍스트부터(PDF/DOCX는 별도 작업으로 보류), `school_policy_review.prompt`는 만들지
  않고 `education_context_exclusion.prompt`로 대체, sample output은 정적 예시만(백엔드
  파일 저장 기능 추가 안 함). 상세 근거는 `todolist.md`의 각 섹션과 "사용자 결정
  사항" 목록에 기록.
- **구현**: `legal-harness/prompts/`에 4개 파일 작성 —
  `legal_search.prompt`, `precedent_summary.prompt`, `contract_review.prompt`,
  `education_context_exclusion.prompt`. 3순위에서 겪은 "코드와 따로 노는 문서가
  조용히 어긋난다"는 문제가 재발하지 않도록, 각 파일 맨 위에 실제 코드와의 연결
  상태를 명시:
  - `education_context_exclusion.prompt`만 이미 실행 중인 코드(`hasExcludedEducationContext`,
    `src/harness.ts`의 `excludedContexts`)를 문서화한 것 — 실제 두 소스 목록을 그대로
    옮겨 적어 정확성 확보.
  - `legal_search.prompt`는 실제 opt-in LLM 시스템 프롬프트
    (`legalCitationSynthesis.service.ts`의 `SYSTEM_PROMPT`)와 같은 취지를 워크플로
    전체 관점에서 설명한 설계 문서라고 명시.
  - `precedent_summary.prompt`, `contract_review.prompt`는 아직 코드에서 쓰이지 않는
    순수 설계 문서(LLM 확장이 결정될 때 사용)라고 명시.
- **검증**: `npm test` 재실행 — 14개 파일, 102 passed + 1 skipped, 프론트엔드 빌드
  통과(문서 파일만 추가라 회귀 없음 확인).

### 3순위 — harness 디렉토리 정리 ✅ (2026-08-01)

- **조사**: `harness/policies/legal-service-policy.json`, `harness/workflows/*.json`(3개)이
  `src/harness.ts`와 같은 정책/워크플로 내용을 다른 스키마(snake_case, 더 납작한 구조)로
  중복 보관 중이었음. `grep`으로 `src/`, `web/` 전체를 확인한 결과 이 4개 파일을 읽는 코드가
  전혀 없음을 확인 — 완전히 죽은 중복이었고, 이미 문구가 미묘하게 어긋나 있었음(예:
  disclaimers 문구가 한 글자씩 다름). 반면 `harness/evals/*.json`(2개)은 `src/evaluate.ts`
  (`npm run eval`)가 실제로 읽어 하네스 정의 텍스트를 검증하는 데 쓰이고 있어 살아있는
  코드로 확인, 그대로 유지.
- **조치**: 죽은 4개 파일(`harness/policies/legal-service-policy.json`,
  `harness/workflows/{contract-review,document-drafting,legal-research}.json`)과 빈
  디렉토리를 삭제. `src/harness.ts`가 워크플로/정책 정의의 단일 소스임을 `README.md`,
  `todolist.md`에 명시.
- **추가로 명확히 한 것**: `harness/evals/*.json`(하네스 정의 자체의 텍스트 검사, `npm run
  eval`)과 `legal-harness/evals/*.yaml`(실제 API 응답의 런타임 동작 검사,
  `src/harnessEval.test.ts`)은 이름이 비슷해 헷갈리기 쉽지만 서로 다른 것을 검증하는
  별개의 장치라 통합하지 않고 README에 차이를 문서화.
- **손대지 않은 것**: `legal-harness/prompts/`, `legal-harness/outputs/{reports,checklists,drafts}/`는
  여전히 빈 폴더(git에 트래킹되지 않는 로컬 디렉토리). 콘텐츠를 채우는 건 `todolist.md`의
  "사용자 결정 필요 사항 #5"(정적 예시만 둘지, 백엔드가 실제로 파일 저장까지 할지)가 먼저
  정해져야 하는 별도 작업이라 이번 정리 범위에서 제외.
- **검증**: 파일 삭제 후 `npm test` 재실행 — 14개 테스트 파일, 102 passed + 1 skipped,
  백엔드/프론트엔드 빌드 모두 그대로 통과(회귀 없음, 삭제한 파일이 실제로 미사용이었음을
  재확인).

### 2순위 — YAML 평가 러너 연결 ✅ (2026-08-01)

- **배경**: `legal-harness/evals/*.yaml` 3개 파일이 작성되어 있었지만 실제로 실행하는
  코드가 없어 죽은 문서였음. Anthropic API 유료 결제 전환은 보류하고(별도
  `LLM_LAUNCH_CHECKLIST.md`로 정리), 키 없이도 할 수 있는 다음 순위 작업으로 착수.
- **구현**: `src/harnessEval.test.ts` — YAML을 읽어 각 케이스를 실제 HTTP 엔드포인트
  (`/api/legal-research`, `/api/contract-review`, `/api/document-draft`)로 호출하고
  `must_include`/`must_not_include`/`fallback_must_include`를 응답 JSON 문자열 대조로
  검증하는 vitest 러너. YAML 파싱은 `yaml` 패키지 신규 추가(devDependency). `vitest run`에
  자동 포함되어 `npm test`로 실행됨(별도 스크립트 불필요).
- **YAML을 실제로 실행해서 발견한 3가지 불일치** (추측이 아니라 실제 응답을 찍어보고 확인):
  1. `contract-review-citation-gap`의 must_include `"인용 검증"`은 `harness.ts`의 정적
     워크플로 메타데이터(예시 출력 설명)에만 존재하고 실제 `/api/contract-review` 응답에는
     전혀 나타나지 않음 — 제거하고 실제로 나타나는 `"근거가 부족한 단정적 분석은
     제한됩니다."`로 교체.
  2. `no-definitive-illegality`의 must_include `"위법 소지가 있어 추가 검토가 필요"`는
     `safetyFilter.service.ts`가 계산하는 치환 텍스트인데, `workflowCompliance.service.ts`가
     이 치환된 텍스트 자체를 응답에 실어 보내지 않고 boolean 플래그(`expertReviewRequired`)와
     경고 문구만 넘김 — 실제로 노출되는 `"위험 표현이 감지되어 전문가 검토가 필요합니다."`로
     교체.
  3. 같은 케이스에서 `must_not_include: "100% 위법"`도 처음엔 실패했음 —
     `authoritySearch.lawSearch.data.query`(검색에 사용한 쿼리를 그대로 에코)와
     `safetyReview.detections[].phrase`(안전 필터가 무엇을 감지했는지 투명하게 보여주는
     진단 정보)에 사용자가 입력한 "100% 위법"이 원문 그대로 나타남. 이건 시스템이 그 문구를
     자기 주장으로 채택한 게 아니라 "이걸 감지해서 플래그를 걸었다"는 진단 echo라 오탐으로
     판단 — 러너에서 `must_not_include` 검사 시 이 두 필드를 제외하도록 수정(진단/메타데이터
     echo와 시스템이 실제로 생성한 결론 텍스트를 구분).
  - `provider-live-check` 케이스는 `LEGAL_PROVIDER=korean-law`가 아닌 환경(기본 mock 모드,
    CI 포함)에서는 참/거짓을 판정할 근거가 없어 `it.skipIf`로 정직하게 건너뜀(가짜로
    통과시키지 않음).
- **검증**: `npm test` 전체 통과 — 14개 테스트 파일, 102 passed + 1 skipped(기존 94 + 신규
  9, provider-live-check만 스킵). 백엔드 `tsc --noEmit`, `src/evaluate.ts` 하네스 자체 평가,
  프론트엔드 빌드 모두 통과.

### Anthropic API 결제 전환 여부 검토 — OpenRouter 대안 기각, 체크리스트 문서화 ✅ (2026-08-01)

- **배경**: 사용자가 보유한 OpenRouter 크레딧으로 LLM 종합 답변 기능을 운영할 수 있는지 문의.
- **조사**: OpenRouter 공식 문서 확인 결과 (1) OpenAI 호환 Chat Completions 형식만 지원,
  Anthropic 네이티브 Citations API(1차 안전장치)는 미지원. (2) 토큰당 가격은 Anthropic 직접과
  동일(마크업 없음), 크레딧 충전 시에만 5~5.5% 수수료. (3) OpenRouter 크레딧을 Anthropic
  Console 계정에 이전하거나 그쪽 결제에 쓰는 방법은 없음(완전히 별개 회사/지갑).
- **결정**: 비용 차이가 미미한 반면 Citations API 손실은 실질적 품질 저하(2차 검증
  `verify_citations`에서 걸러지는 빈도 증가 → LLM 종합 답변을 실제로 받는 비율 감소)로 판단해
  Anthropic 직접 결제 유지로 결정. 실제 결제 전환 시 필요한 작업은 `LLM_LAUNCH_CHECKLIST.md`에
  체크리스트로 정리(Console 결제 설정, 시크릿 관리, 라이브 종단 검증, 비용 모니터링 등).
- **상태**: 결제는 보류, 코드 변경 없음. 문서만 추가.

### LLM 종합 답변(opt-in) — Citations API + 이중 인용 검증 ✅ (2026-08-01)

- **배경**: "여전히 형식적인 대답만 나온다"는 지적 — 원인은 파이프라인에 LLM이 아예
  없고 검색(retrieval)만 있었기 때문. 사용자가 "LLM + 법률 MCP를 함께 연결해
  환각을 최소화한 사이트"를 만들고 싶다고 해서 설계를 시작.
- **도구 선정 재검토**: 처음 설계했던 "LLM이 인용 배열을 반환하면 코드로 직접
  대조"하는 방식을 사용자 요청으로 재검토. 조사 결과 더 나은 기성 대안 두 가지를
  발견해 채택:
  1. **Anthropic Citations API** — 검색된 법령 원문을 `document` 콘텐츠 블록으로
     전달하고 `citations: {enabled: true}`를 켜면, 생성 단계 자체가 제공 문서의
     특정 구절에 강제로 묶임(1차 방어선). 구조화 출력과는 함께 못 쓴다는 점 확인.
  2. **`korean-law` CLI의 `verify_citations` 도구** — 몰랐던 기성 도구. 텍스트에서
     조문 인용을 자동 추출해 법제처 원문 DB와 직접 대조. 라이브 테스트로 실제
     환각(지어낸 조문 2개)을 정확히 잡아내는 것을 확인(exit code 1,
     `[HALLUCINATION_DETECTED]` 마커). 직접 만들려던 배열 대조 로직보다 우월 —
     우리가 사전에 검색했는지와 무관하게 원천 DB로 검증.
  - 두 API 모두 공식 문서(Claude API skill, 실제 CLI `--help`)로 스키마를
    검증 후 구현 — 추측 없이 진행.
- **구현**:
  - `src/services/legalCitationSynthesis.service.ts` — Citations API 호출,
    `authoritySearch`의 법령 조문(본문 있는 것만)을 문서로 변환. 판례는 검색
    단계에서 제목만 있고 전문이 없어 이번 버전에서는 제외(추후 확장 여지로 기록).
  - `src/services/citationGroundingVerifier.service.ts` — `verify_citations` CLI
    래퍼. 실제 CLI 출력 3종(HALLUCINATION_DETECTED/PARTIAL_VERIFIED/VERIFIED)을
    fixture로 고정해 파서를 회귀 테스트.
  - `src/services/legalAnswerSynthesis.service.ts` — 위 둘을 조합하는 오케스트레이션.
    2차 검증에서 환각이 감지되면 답변 전체를 폐기(문장 일부만 제거하면 문맥이
    깨질 수 있어, 프로젝트의 기존 원칙대로 애매하면 확실한 실패로 표시).
  - `LLM_SYNTHESIS_ENABLED` 환경변수로 opt-in — 꺼져 있거나 `ANTHROPIC_API_KEY`가
    없으면 항상 안전하게 `used: false`로 폴백, 기존 규칙 기반 결과는 그대로 유지.
  - 파일럿으로 `legalResearch.workflow.ts`에만 연결(다른 워크플로는 확장 후보로 남김).
  - 프론트엔드에 "AI 종합 답변 (실험적)" 섹션 추가 — 비활성 상태에서는 왜
    비활성인지 문구로 안내.
- **제약**: `ANTHROPIC_API_KEY`가 아직 없어 실제 LLM 호출은 라이브 검증하지
  못함(사용자 요청에 따라 "키 없이 코드 구조만 먼저" 진행). 대신:
  - Citations API 요청 스키마는 Anthropic 공식 문서로 정확히 검증.
  - `verify_citations`는 `LAW_OC`만 있으면 되므로 실제 CLI로 라이브 검증 완료.
  - 비활성 상태(기본값)에서 전체 워크플로가 회귀 없이 동작하는 것은 브라우저로 확인.
- **검증**: vitest 신규 14개(`citationGroundingVerifier` 5개, `legalCitationSynthesis`
  6개, `legalAnswerSynthesis` 3개) — 소송 준비 기능 완료 시점 80개에서 총 94개로
  증가. 백엔드/프론트엔드 빌드 통과, 브라우저로 "AI 종합 답변" 섹션과 안내 문구
  실제 확인.
- **다음 단계 후보(미착수)**: 실제 API 키로 라이브 종단 검증, 판례 전문
  조회(`get_precedent_text`) 후 판례도 Citations 문서로 포함, 다른 워크플로
  (계약서 검토·문서 초안·소송 준비)로 확장, `verify_citations`의 "확인필요(⚠)"
  상태가 자연스러운 한국어 문장에서 자주 발생하는 파싱 한계를 완화할지 검토.

### 소송 준비 체크리스트 기능 신규 개발 ✅ (2026-07-31)

- **배경**: "승소를 전제로 진행하는 방향 말고, 어떤 정보를 얻고 어떤 서류들을 준비해야 하는
  소송준비를 위한 안내 자료를 제공할 수 있는 서비스"를 구상 중이라는 요청. 기존 정책
  (`최종 법률 자문, 승소 보장... 사용 불가`)에 이미 부합하는 방향이라 4순위 LLM 도입 여부와
  독립적으로 지금 착수 가능하다고 판단.
- **구조 결정**: 형사/민사/가정법원 3개 분야로 나누고, 사용자가 어디에 해당하는지 모를 때
  키워드로 해당 분야를 안내하는 구조. LLM 없이 규칙 기반 체크리스트로 먼저 시작(사용자 선택).
- **구현**:
  - `src/services/litigationChecklistCatalog.service.ts` — 분야별 체크리스트 콘텐츠 큐레이션
    (필요 증거, 준비할 서류, 기한/시효, 관할 안내, 소송 전 조치). 시작 세트는 분야당 1개
    (대금/용역비 미지급, 고소장 제출 준비, 이혼 소송 준비)로 제한해 콘텐츠 정확성 부담을 관리.
  - `src/services/litigationDomainRouter.service.ts` — 키워드 매칭 라우터. 사건 유형 → 분야
    2단계로 매칭을 시도하고, 매칭 안 되면 "unclear"로 정직하게 반환(억지 추측 없음).
  - `src/workflows/litigationPrep.workflow.ts` — 사건 유형이 확정되면 기존 `korean-law` 검색과
    인용 검증(`workflowCompliance.service.ts`, 수정 없이 재사용)을 그대로 태워 체크리스트에
    실제 법령 근거를 붙임. 확정되지 않으면 전체 카탈로그를 보여줘 사용자가 직접 선택하게 함.
  - `mcpLegal.service.ts`에 `researchGeneralAuthorities(query)` 범용 메서드 추가.
  - `POST /api/litigation-prep`, `GET /api/litigation-prep/catalog` 신규 엔드포인트.
  - `web/src/App.tsx`에 "소송 준비" 탭 추가. 기존 `mockResult`/`KeyValueSection` 렌더링을
    그대로 재사용해 프론트엔드 핵심 로직 변경 없이 새 필드(`classificationScope`,
    `browseCatalog`)만 추가.
- **이슈 #1 안전장치 자동 적용 확인**: 체크리스트가 확정되면 `researchGeneralAuthorities`가
  이슈 #1에서 만든 관련성 필터를 그대로 통과하므로, 별도 작업 없이 "질문과 관련성이 낮은 결과
  일부를 제외했습니다" 경고가 소송 준비 탭에도 동일하게 적용됨을 라이브로 확인.
- **버그 수정**: 체크리스트가 확정되지 않은 응답(`authoritySearch` 없음)에서 상단 배지가
  `formatProvider(undefined)`의 기본값으로 "개발용 모의 검색 제공자"를 잘못 표시하던 문제를
  라이브 브라우저 검증 중 발견해 수정 — `authoritySearch`가 있을 때만 배지를 표시하도록 변경.
- **환경 이슈**: 검증 중 이전 세션에서 종료되지 않고 남아있던 포트 3000 좀비 프로세스 때문에
  새 라우트가 404로 응답하는 문제가 있었음. 부모/자식 프로세스(`tsx` → `node`)를 둘 다 종료해야
  완전히 정리됨을 확인.
- **검증**: 신규 vitest 19개(카탈로그, 라우터, mcpLegal 서비스, app.test.ts) 포함 전체
  61 → 80개 통과. 백엔드/프론트엔드 빌드 통과. 브라우저로 3가지 분류 케이스(사건 유형 확정 /
  분야만 확정 / 완전 불명확) 모두 실제 UI에서 확인.
- **다음 단계 후보(미착수)**: 사건 유형을 분야당 1개에서 확장(사용자 결정 필요), 문서 초안
  워크플로처럼 소송 준비 결과를 파일로 저장하는 기능, 4순위 LLM 도입 시 체크리스트를 사용자
  사실관계에 맞게 맞춤화하는 확장.

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

### 이슈 #4 조치 ✅ (2026-07-31, 같은 날 처리)

- 실행 버튼에 회전 스피너를 추가하고, 결과 대기 중인 출력 패널을 큰 스피너 +
  "결과를 불러오는 중입니다" + provider 호출이 몇 초 걸릴 수 있다는 안내로 교체.
  순수 CSS 애니메이션만 사용(추가 의존성 없음), `prefers-reduced-motion` 대응 포함.
- **검증**: 클릭 직후(~80ms) DOM을 확인해 버튼/패널 스피너와 로딩 문구가 모두 나타남을
  라이브로 확인, 스크린샷으로도 캡처. 응답 도착 후 리포트 화면으로 정상 전환되는 것도 확인.
  프론트엔드 빌드 통과, 백엔드 vitest 61개 그대로 통과(프론트엔드 전용 변경).
- 이로써 UAT에서 발견된 이슈 4건(#1~#4) 전부 조치 완료.

## 다음 순위 (미착수)

### 4순위 — LLM 도입 여부 결정 (일부 진행, 실제 결제는 보류)

- `legal_research` 워크플로에는 opt-in LLM 종합 답변이 구현됨(위 "LLM 종합 답변" 항목
  참고, `@anthropic-ai/sdk` 의존성 추가됨). 단 `ANTHROPIC_API_KEY`가 없어 기본값은 항상
  비활성 — 실제 결제 전환 시 필요한 작업은 `LLM_LAUNCH_CHECKLIST.md` 참고.
- `contract_review`, `document_drafting`, `litigation_prep`은 여전히 키워드 매칭
  (`legalWorkflow.service.ts`)뿐이며 LLM 호출 없음 — 확장 여부는 미결정.
- `analyze_document`, `chain_document_review` 등 계약서 검토에 적합한 korean-law
  CLI 도구(80개 이상 도구 중)가 아직 활용되지 않음.

## 참고 링크

- PR: https://github.com/luludaniel/mcp_service/pull/1
- 테스트 케이스: `USER_TESTING.md`
- 초기 구상 대비 차이 분석: `todolist.md`
