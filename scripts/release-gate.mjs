import { spawnSync } from "node:child_process";

const allowDirty = process.argv.includes("--allow-dirty");

function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    stdio: options.capture ? "pipe" : "inherit",
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function capture(command) {
  return run(command, { capture: true });
}

function printSection(title) {
  console.log(`\n[release-gate:${title}]`);
}

function getStatus() {
  const branch = capture("git branch --show-current");
  const head = capture("git rev-parse --short HEAD");
  const status = capture("git status --short");
  const lines = status.stdout ? status.stdout.split(/\r?\n/) : [];
  const tracked = lines.filter((line) => !line.startsWith("??"));
  const untracked = lines.filter((line) => line.startsWith("??"));

  return {
    branch: branch.ok ? branch.stdout : "unavailable",
    head: head.ok ? head.stdout : "unavailable",
    tracked,
    untracked,
  };
}

function printStatus(label, status) {
  printSection(label);
  console.log(`branch: ${status.branch}`);
  console.log(`head: ${status.head}`);
  console.log(`tracked dirty: ${status.tracked.length}`);
  if (status.tracked.length > 0) {
    for (const line of status.tracked) {
      console.log(`  ${line}`);
    }
  }
  console.log(`untracked: ${status.untracked.length}`);
  if (status.untracked.length > 0) {
    for (const line of status.untracked) {
      console.log(`  ${line}`);
    }
  }
}

function runStep(label, command) {
  printSection(label);
  const result = run(command);
  if (!result.ok) {
    console.error(`[release-gate] ${label} failed with exit ${result.status}`);
    process.exit(result.status);
  }
  console.log(`[release-gate] ${label}: passed`);
}

function classifyOpsDoctor(output) {
  const hasDrift = output.includes("migration drift: detected");
  const remoteOnlyNone = output.includes("remote-only: none");

  if (hasDrift && remoteOnlyNone) {
    return "known-drift";
  }

  if (output.includes("migration drift: none")) {
    return "none";
  }

  if (hasDrift) {
    return "needs-review";
  }

  return "unavailable";
}

const startStatus = getStatus();
printStatus("start", startStatus);

runStep("lint", "npm run lint");
runStep("typescript", "npx tsc --noEmit");
runStep("scenario", "npm run test:scenario");
runStep("workflow-policy", "npm run check:workflow-policy");
runStep("build", "npm run build");

printSection("ops-doctor");
const opsDoctor = capture("npm run ops:doctor");
if (opsDoctor.stdout) {
  console.log(opsDoctor.stdout);
}
if (opsDoctor.stderr) {
  console.error(opsDoctor.stderr);
}
if (!opsDoctor.ok) {
  console.error(`[release-gate] ops:doctor failed with exit ${opsDoctor.status}`);
  process.exit(opsDoctor.status);
}
console.log(`[release-gate] Supabase migration drift: ${classifyOpsDoctor(opsDoctor.stdout)}`);

const endStatus = getStatus();
printStatus("end", endStatus);

if (endStatus.tracked.length > 0 && !allowDirty) {
  console.error("[release-gate] tracked files are dirty after validation");
  console.error("[release-gate] commit or restore tracked changes, then rerun npm run check:release");
  process.exit(1);
}

if (endStatus.tracked.length > 0 && allowDirty) {
  console.warn("[release-gate] tracked dirty files allowed by --allow-dirty");
}

console.log("\n[release-gate] passed");
