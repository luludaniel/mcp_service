# 법률 MCP 하네스

이 저장소는 일반 사용자, 기업, 전문직 사용자를 위한 법률 리서치, 계약서 검토, 문서 초안 작성 보조 최소 기능 제품입니다.

학교, 교육기관, 수업, 과제, 교사 피드백, 성적 평가 등 교육 맥락은 서비스 범위에서 제외합니다.

이 서비스는 법률 정보 제공과 문서 초안 작성 보조만 제공합니다. 최종 법률 자문, 승소 보장, 위법 단정, 소송 결과 예측으로 사용할 수 없습니다.

## 주요 기능

- Express 백엔드 API와 Zod 입력 검증
- React 최소 기능 UI 4개 화면
  - 법률 질문
  - 계약서 검토
  - 문서 초안
  - 소송 준비 (형사/민사/가정법원 체크리스트, 키워드 기반 분야 자동 안내)
- 개발용 규칙 기반 모의 워크플로
- 법령 검색 제공자 계층
  - `mock`
  - `korean-law`
- 단정적 법률 표현을 완화하는 안전 필터
- 법령/판례 출처 충분성을 확인하는 인용 검증기
- 워크플로 응답의 안전 검토 및 인용 검증 결과 표시
- API 응답과 UI에 전문가 검토 필요 여부 표시

## 저장소 구조

```text
src/        Express 백엔드, 워크플로, 서비스, 타입
harness/    JSON 기반 워크플로, 정책, 평가 메타데이터
web/        React 최소 기능 UI
```

초기 구상인 `/legal-harness` 산출물 구조는 아직 완전히 생성되어 있지 않습니다. 빠진 항목과 다음 작업 계획은 `todolist.md`를 참고하세요.

## 백엔드 실행

저장소 루트에서 실행합니다.

```bash
npm install
npm run dev
```

기본 백엔드 주소:

```text
http://localhost:3000
```

주요 엔드포인트:

```text
GET  /health
POST /api/legal-research
POST /api/contract-review
POST /api/document-draft
GET  /api/litigation-prep/catalog
POST /api/litigation-prep
```

요청 예시:

```bash
curl -X POST http://localhost:3000/api/legal-research \
  -H "Content-Type: application/json" \
  -d '{"question":"프리랜서 용역대금을 지급받지 못한 경우 검토할 수 있는 민사 조치를 알려주세요."}'
```

`소송 준비` — 형사/민사/가정법원 사건 유형별 준비 체크리스트를 규칙 기반(LLM 미사용)으로 제공합니다.
입력 문장의 키워드로 사건 유형을 먼저, 그다음 분야만이라도 매칭을 시도하고, 매칭되지 않으면 추측하지
않고 전체 카탈로그를 보여줘 사용자가 직접 고를 수 있게 합니다.

```bash
curl -X POST http://localhost:3000/api/litigation-prep \
  -H "Content-Type: application/json" \
  -d '{"situation":"프리랜서로 일했는데 3개월째 용역대금을 못 받았어요."}'
```

콘텐츠는 `src/services/litigationChecklistCatalog.service.ts`에 큐레이션되어 있으며, 현재는 분야당
1개(대금/용역비 미지급, 고소장 제출 준비, 이혼 소송 준비)로 시작해 확장 가능한 구조입니다. "승소 예측"이
아닌 "정보 수집·서류 준비 안내"에 한정되도록 설계했습니다.

## 프론트엔드 실행

다른 터미널에서 실행합니다.

```bash
cd web
npm install
npm run dev
```

기본 프론트엔드 주소:

```text
http://127.0.0.1:5173/
```

`5173` 포트가 이미 사용 중이면 Vite가 다음 사용 가능한 포트를 자동으로 선택합니다.

## 환경변수

필요하면 루트에 `.env` 파일을 만듭니다.

```bash
LEGAL_PROVIDER=mock
LAW_OC=
```

제공자 모드:

```text
LEGAL_PROVIDER=mock       개발용 결정론적 데이터를 사용합니다.
LEGAL_PROVIDER=korean-law korean-law CLI를 child_process로 호출합니다.
```

`LEGAL_PROVIDER=korean-law`를 사용할 때는 `LAW_OC` 값이 필요합니다.

실제 제공자 호출에 실패하더라도 워크플로는 중단되지 않고 다음 문구를 결과에 포함합니다.

```text
검색 실패
수동 확인 필요
```

### LLM 종합 답변 (선택, opt-in)

`법률 질문` 워크플로는 검색된 법령 원문을 근거로 LLM이 답변을 종합하는 기능을 추가로
제공합니다. 기본값은 비활성화이며, 켜지 않으면 기존 규칙 기반 결과만 표시됩니다.

```bash
LLM_SYNTHESIS_ENABLED=true
ANTHROPIC_API_KEY=<Anthropic API 키>
```

환각 방지를 위해 이중 안전장치를 사용합니다.

1. **Anthropic Citations API** — 검색된 법령 원문을 문서로 전달해, 답변 생성 자체를
   해당 문서의 특정 구절에 근거하도록 강제합니다.
2. **`korean-law` CLI의 `verify_citations`** — 생성된 답변에서 인용을 추출해 법제처
   원문 DB와 직접 재대조합니다. 검증되지 않은 인용이 발견되면 답변 전체를 표시하지
   않고 규칙 기반 결과로 폴백합니다.

`ANTHROPIC_API_KEY`가 없거나 `LLM_SYNTHESIS_ENABLED`가 꺼져 있으면 항상 안전하게
비활성 상태로 동작하며, 이유가 응답의 `llmSynthesis.notice`에 명시됩니다.

## 테스트

백엔드, 서비스, 하네스 평가, 프론트엔드 빌드 검증을 모두 실행합니다.

```bash
npm test
```

프론트엔드 빌드만 확인:

```bash
npm run test:web
```

백엔드 검사만 실행:

```bash
npm run build
npm run eval
vitest run
```

## 현재 한계

- 실제 `korean-law` CLI 연동은 `LAW_OC` 키로 live 검증을 완료했습니다. CLI가 반환하는 사람이 읽는 텍스트를
  구조화된 인용 데이터로 바꾸는 파서는 `src/services/koreanLawParser.service.ts`에 있으며, 실제 응답을
  `src/services/fixtures/`에 고정해 회귀 테스트로 검증합니다. 자세한 CLI 계약은
  `legal-harness/mcp_servers/korean_law_mcp/README.md`를 참고하세요.
- 외부 API 호출이 실패하거나 `LAW_OC`가 없으면 워크플로는 중단되지 않고 `검색 실패`, `수동 확인 필요`를 반환합니다.
- 프론트엔드는 최소 기능 UI에서 수동 API 호출을 수행하며, 자동 브라우저 e2e 테스트는 아직 없습니다.
- 생성되는 문서 결과는 초안으로만 사용해야 하며 제출, 서명, 발송 전 전문가 검토가 필요합니다.

## 언어 정책

- 사용자에게 보이는 UI 라벨, API 모의 결과, 문서 설명은 한국어 중심으로 작성합니다.
- API 필드명, endpoint, 제공자 이름, 패키지명, 함수명 같은 기술 식별자는 호환성을 위해 영어를 유지합니다.
