# AGENTS.md

## Purpose

This project uses a lightweight multi-agent harness (`codex_harness/`) that runs
with either the Codex CLI or the Claude Code CLI — see
`codex_harness/README.md` for how `agent-runner.mjs` picks the CLI.

## Roles

- architect: analyzes requirements and designs the solution
- implementer: modifies code
- tester: writes or runs tests
- reviewer: reviews quality, security, and maintainability
- debugger: fixes test failures and runtime errors

## Rules

- Make small, focused changes.
- Do not modify unrelated files.
- Inspect files before editing.
- Run tests after code changes.
- Do not expose secrets, tokens, API keys, or private credentials.
- For this legal MCP project, check `codex_harness/project-checklist.md` before approving changes.
- Keep user-facing service text Korean-first.
- Preserve API field names, endpoint paths, provider enum values, and TypeScript identifiers unless a migration is explicitly requested.
- Do not add school, education institution, classroom, assignment, teacher feedback, or grading workflows.
- Treat all legal outputs as legal information or drafts, not final legal advice.
- Summarize changed files, commands run, and remaining risks.

## Final Response Format

When completing a task, summarize:

1. What changed
2. Files changed
3. Tests run
4. Remaining risks or TODOs
