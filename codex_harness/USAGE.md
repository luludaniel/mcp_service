# 하네스 사용 기록

이 문서는 `codex_harness`를 실제로 어떻게 썼는지와 다음 작업 때 참고할 실행
절차를 정리합니다.

## 2026-08-01 — Claude Code CLI 겸용으로 확장

- **배경**: 앞으로 이 프로젝트를 Claude Code로 작업하기로 하면서, Codex CLI
  전용으로 만들어뒀던 이 하네스를 계속 쓸 수 있는지 검토했습니다.
- **조사 결과**: `.agents/roles/*.md`(architect/implementer/tester/reviewer/debugger
  역할 정의), `.agents/workflows/*.md`(역할 실행 순서), `project-checklist.md`,
  `scripts/test.sh`, `scripts/review.sh`는 전부 특정 CLI에 종속되지 않는 순수
  마크다운/셸 스크립트였습니다. Codex 전용이었던 부분은 `scripts/agent-runner.mjs`
  안의 `spawnSync("codex", ["exec", ...])` 호출 하나뿐이었습니다.
- **조치**: `agent-runner.mjs`가 `claude`와 `codex` CLI를 둘 다 지원하도록 수정.
  설치된 CLI를 자동 감지(`claude` 우선)하고 `--tool`로 명시 지정도 가능합니다.
  Codex의 `--sandbox read-only|workspace-write`를 Claude의 `--permission-mode`로
  매핑했습니다(read-only 역할 → `plan` 모드, 나머지 → `bypassPermissions`) —
  단, 이 둘은 격리 수준이 다른 별개의 메커니즘이라는 점을 README에 명시해뒀습니다.
- **검증**: `node --check`로 문법 확인, `--tool bogus`/미지원 workflow 등
  인자 검증 경로를 실제로 실행해 에러 처리가 올바른지 확인. 실제 역할 실행
  (`claude`/`codex` 서브프로세스를 진짜로 띄우는 것)은 이번 세션에서는 검증하지
  않았습니다 — 다음에 실제로 `node codex_harness/scripts/agent-runner.mjs
  review-and-refactor "..."` 를 돌려서 라이브로 확인하는 것을 권장합니다.
- **참고**: 이미 Claude Code + oh-my-claudecode 세션 안에 있다면 이 스크립트
  없이도 `Agent` 도구나 `/team` 스킬로 같은 역할 분업을 세션 안에서 바로 쓸 수
  있습니다. 이 스크립트는 그런 세션이 없을 때(터미널 단발 실행, CI 등) 헤드리스로
  같은 워크플로를 돌리는 용도입니다.

## 이전 기록 (Codex CLI, 2026-06-12)

핵심 파일: `project-checklist.md`, `scripts/test.sh`, `scripts/review.sh`,
`scripts/agent-runner.mjs`.

검증한 작업:

```bash
bash codex_harness/scripts/test.sh
```

검증 내용: TypeScript 빌드, 하네스 eval, Vitest, 웹 빌드.
당시 결과(2026-06-12 기준, 현재는 테스트 수가 훨씬 늘어났습니다 — 최신 수치는
`npm test` 실행 결과 또는 `PROGRESS.md` 참고): `6 files passed`, `25 tests
passed`, `web build passed`.

```bash
bash codex_harness/scripts/review.sh
```

검증 내용: `git status`, `git diff --stat`, `git diff` — 커밋 전 변경 사항 검토용.

당시 실행 결과 리포트(`reports/current-project-review.md`)는 이제 크게
outdated되어(25개 테스트 시절 기준) 제거했습니다. 리포트는 실행할 때마다
`reports/`에 새로 쌓이는 것이 원래 용도이며, 과거 시점 스냅샷을 영구 보관할
필요는 없다고 판단했습니다.
