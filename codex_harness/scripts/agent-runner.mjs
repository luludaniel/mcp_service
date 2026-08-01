import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const harnessRoot = resolve(scriptDir, "..");
const projectRoot = resolve(harnessRoot, "..");

const rawArgs = process.argv.slice(2);
const toolFlagIndex = rawArgs.findIndex((arg) => arg === "--tool");
let requestedTool = null;
if (toolFlagIndex !== -1) {
  requestedTool = rawArgs[toolFlagIndex + 1];
  rawArgs.splice(toolFlagIndex, 2);
}

const [workflowName, ...taskParts] = rawArgs;
const userTask = taskParts.join(" ");

if (!workflowName || !userTask) {
  console.error("Usage:");
  console.error(
    '  node codex_harness/scripts/agent-runner.mjs [--tool codex|claude] <workflow> "<task>"'
  );
  console.error("");
  console.error("Workflows:");
  console.error("  implement-feature");
  console.error("  fix-bug");
  console.error("  review-and-refactor");
  console.error("");
  console.error(
    "--tool defaults to whichever of `claude`/`codex` is installed (claude preferred if both are)."
  );
  process.exit(1);
}

function commandExists(command) {
  const probe = process.platform === "win32" ? "where" : "which";
  return spawnSync(probe, [command], { stdio: "ignore" }).status === 0;
}

function detectTool() {
  if (commandExists("claude")) return "claude";
  if (commandExists("codex")) return "codex";
  return null;
}

const tool = requestedTool ?? detectTool();

if (tool !== "codex" && tool !== "claude") {
  console.error(
    `No supported CLI found (looked for "claude" and "codex", got --tool=${requestedTool ?? "(auto)"}).`
  );
  console.error('Install the Claude Code CLI ("claude") or Codex CLI ("codex"), or pass --tool explicitly.');
  process.exit(1);
}

/**
 * Codex's `--sandbox read-only|workspace-write` and Claude's `--permission-mode`
 * are not the same mechanism (Codex sandboxes at the OS/container level; Claude's
 * modes only control whether tool calls are auto-approved). "read-only" here maps
 * to Claude's `plan` mode, which analyzes without applying edits — the closest
 * available equivalent, not an identical guarantee.
 */
function buildInvocation(tool, sandbox, fullPrompt) {
  if (tool === "codex") {
    return { command: "codex", args: ["exec", "--sandbox", sandbox, "--color", "never", fullPrompt] };
  }

  const permissionMode = sandbox === "read-only" ? "plan" : "bypassPermissions";
  return {
    command: "claude",
    args: ["--print", "--output-format", "text", "--permission-mode", permissionMode, fullPrompt],
  };
}

const roles = {
  architect: join(harnessRoot, ".agents/roles/architect.md"),
  implementer: join(harnessRoot, ".agents/roles/implementer.md"),
  tester: join(harnessRoot, ".agents/roles/tester.md"),
  reviewer: join(harnessRoot, ".agents/roles/reviewer.md"),
  debugger: join(harnessRoot, ".agents/roles/debugger.md"),
};

const workflows = {
  "implement-feature": ["architect", "implementer", "tester", "reviewer"],
  "fix-bug": ["tester", "debugger", "tester", "reviewer"],
  "review-and-refactor": ["reviewer", "implementer", "tester", "reviewer"],
};

const selectedRoles = workflows[workflowName];

if (!selectedRoles) {
  console.error(`Unknown workflow: ${workflowName}`);
  process.exit(1);
}

if (!existsSync(join(projectRoot, "package.json"))) {
  console.error(`Project root not found: ${projectRoot}`);
  console.error("Expected package.json one directory above codex_harness.");
  process.exit(1);
}

const reportsDir = join(harnessRoot, "reports");
mkdirSync(reportsDir, { recursive: true });

let context = `
# User Task

${userTask}

# Previous Agent Outputs

None yet.
`;

console.log(`Using CLI: ${tool}${requestedTool ? "" : " (auto-detected)"}\n`);

for (const roleName of selectedRoles) {
  const rolePrompt = readFileSync(roles[roleName], "utf8");

  const sandbox =
    roleName === "architect" || roleName === "reviewer" ? "read-only" : "workspace-write";

  const fullPrompt = `
${rolePrompt}

# Current Workflow

${workflowName}

# Task Context

${context}

# Role Instruction

Work as the ${roleName} agent.
Follow AGENTS.md and your role definition.

# Important

- If you are architect or reviewer, do not edit files.
- If you are implementer, tester, or debugger, edit only necessary files.
- Report exact files changed and commands run.
`;

  console.log("\n==============================");
  console.log(`Running role: ${roleName}`);
  console.log(`Sandbox: ${sandbox}`);
  console.log("==============================\n");

  const { command, args } = buildInvocation(tool, sandbox, fullPrompt);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: projectRoot,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (stderr.trim()) {
    console.error(stderr);
  }

  console.log(stdout);

  const reportPath = join(reportsDir, `${Date.now()}-${tool}-${roleName}.md`);
  writeFileSync(reportPath, stdout);

  context += `

---

# Output from ${roleName}

${stdout}
`;

  if (result.status !== 0) {
    console.error(`Role ${roleName} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }

  if (roleName === "reviewer" && stdout.includes("NEEDS_CHANGES")) {
    console.log("\nReviewer requested changes.");
    console.log("Recommended next command:");
    console.log(`node codex_harness/scripts/agent-runner.mjs --tool ${tool} fix-bug "${userTask}"`);
  }
}

console.log("\nWorkflow complete.");
