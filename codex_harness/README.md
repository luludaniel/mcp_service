# 프로젝트 점검 하네스 (Codex CLI / Claude Code CLI 겸용)

이 폴더는 법률 MCP 하네스 프로젝트를 점검하고 보완 작업을 반복하기 위한 역할 기반
멀티 에이전트 하네스입니다. 원래 Codex CLI 전용으로 만들었으나(2026-07-30),
`.agents/roles/*.md`·`.agents/workflows/*.md`·`project-checklist.md` 내용 자체는
특정 CLI에 종속되지 않는 순수 프롬프트/체크리스트라, Claude Code CLI도 함께
지원하도록 `agent-runner.mjs`만 수정했습니다(2026-08-01, 상세 내용은
`USAGE.md` 참고).

## 사용 방법

프로젝트 루트에서 실행합니다.

```bash
bash codex_harness/scripts/test.sh
bash codex_harness/scripts/review.sh
```

역할 기반 워크플로는 `claude`와 `codex` CLI 둘 다 지원합니다. 설치된 CLI를
자동으로 감지하며(`claude`가 있으면 우선 사용), `--tool`로 명시할 수도 있습니다.

```bash
node codex_harness/scripts/agent-runner.mjs review-and-refactor "법률 MCP 하네스 전체 점검"
node codex_harness/scripts/agent-runner.mjs --tool claude implement-feature "document_reader_mcp 최소 명세 추가"
node codex_harness/scripts/agent-runner.mjs --tool codex fix-bug "교육 맥락 차단 누락 케이스 수정"
```

역할별 실행 결과는 `codex_harness/reports/`에 저장됩니다(파일명에 사용한 CLI가
표시됩니다, 예: `<timestamp>-claude-reviewer.md`).

### Claude Code CLI 사용 시 주의

Codex의 `--sandbox read-only|workspace-write`와 Claude의 `--permission-mode`는
동일한 개념이 아닙니다 — Codex 샌드박스는 OS/컨테이너 수준 격리이고, Claude의
permission mode는 도구 호출을 자동 승인할지 여부만 결정합니다.
`agent-runner.mjs`는 read-only 역할(architect/reviewer)을 Claude의 `plan`
모드로, 나머지(implementer/tester/debugger)를 `bypassPermissions`로 매핑합니다
— `bypassPermissions`는 파일 수정·명령 실행을 확인 없이 자동 승인하므로,
신뢰하는 프로젝트에서만 사용하세요.

### 이미 Claude Code(oh-my-claudecode) 세션 안에 있다면

지금처럼 Claude Code + oh-my-claudecode로 이미 대화 중이라면, 이 스크립트를
셸에서 따로 실행할 필요 없이 `Agent` 도구(`architect`, `executor`,
`code-reviewer`, `debugger`, `test-engineer` 등)나 `/team` 스킬로 같은 역할
분업을 세션 안에서 바로 쓸 수 있습니다. 이 스크립트는 그런 세션이 없는 환경
(터미널에서 단발성 실행, CI, 다른 도구로 실행 중)에서 헤드리스로 같은
워크플로를 돌리고 싶을 때 유용합니다.

## 현재 프로젝트 점검 기준

법률 MCP 하네스 점검은 `project-checklist.md`를 기준으로 수행합니다.

핵심 기준:

- 학교, 교육기관, 수업 맥락 차단
- 정보 제공 및 초안 작성 보조 범위 유지
- 승소 보장, 위법 단정, 최종 판단 금지
- 전문가 검토 필요 여부 표시
- 출처 부족 시 수동 확인 또는 출처 확인 필요 표시
- `npm test` 통과
