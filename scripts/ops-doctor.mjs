import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function run(command) {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: true,
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function printSection(title, lines) {
  console.log(`\n[${title}]`);
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

function firstNonEmptyLine(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^>\s*/, "").trim())
    .find((line) => line.length > 0);
}

function parseGithubUser(output) {
  const match = output.match(/Logged in to github\.com account\s+([^\s]+)/);
  return match?.[1] || null;
}

function parseVercelUser(output) {
  const match = output.match(/Logged in as\s+(.+)/);
  if (match?.[1]) {
    return match[1].trim();
  }

  return firstNonEmptyLine(output) || null;
}

function parseSupabaseVersion(output) {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match?.[1] || null;
}

function parseSupabaseLinkedProject(output) {
  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.includes("|") || !rawLine.includes("●")) {
      continue;
    }

    const columns = rawLine.split("|").map((part) => part.trim());
    if (columns.length < 6) {
      continue;
    }

    return `${columns[3]} (${columns[2]})`;
  }

  return null;
}

function parseMigrationDrift(output) {
  const localOnly = [];
  const remoteOnly = [];

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.includes("|")) {
      continue;
    }

    const columns = rawLine.split("|").map((part) => part.trim());
    if (columns.length < 3) {
      continue;
    }

    const [local, remote] = columns;
    if (!local || local === "Local" || /^-+$/.test(local)) {
      continue;
    }

    if (local && !remote) {
      localOnly.push(local);
    }

    if (!local && remote) {
      remoteOnly.push(remote);
    }
  }

  return { localOnly, remoteOnly };
}

function formatList(label, values) {
  if (values.length === 0) {
    return `${label}: none`;
  }

  const preview = values.slice(0, 5).join(", ");
  const suffix = values.length > 5 ? ` (+${values.length - 5} more)` : "";
  return `${label}: ${preview}${suffix}`;
}

const gitBranch = run("git rev-parse --abbrev-ref HEAD");
const gitRemote = run("git remote get-url origin");
const gitStatus = run("git status --short");
printSection("git", [
  `branch: ${gitBranch.ok ? gitBranch.stdout : "unavailable"}`,
  `origin: ${gitRemote.ok ? gitRemote.stdout : "unavailable"}`,
  gitStatus.ok && gitStatus.stdout.length === 0 ? "worktree: clean" : "worktree: dirty",
]);

const ghAuth = run("gh auth status");
const ghRepo = run("gh repo view --json name,owner,defaultBranchRef,url");
const ghPr = run("gh pr view --json number,title,state,headRefName,baseRefName,url");
const ghRuns = run("gh run list -L 1");
printSection("github", [
  ghAuth.ok
    ? `auth: connected as ${parseGithubUser(ghAuth.stdout) || "unknown"}`
    : `auth: unavailable (${firstNonEmptyLine(ghAuth.stderr || ghAuth.stdout) || "failed"})`,
  ghRepo.ok
    ? `repo: ${JSON.parse(ghRepo.stdout).owner.login}/${JSON.parse(ghRepo.stdout).name} -> ${JSON.parse(ghRepo.stdout).defaultBranchRef.name}`
    : `repo: unavailable (${firstNonEmptyLine(ghRepo.stderr || ghRepo.stdout) || "failed"})`,
  ghPr.ok
    ? (() => {
        const pr = JSON.parse(ghPr.stdout);
        return `pr: #${pr.number} ${pr.state.toLowerCase()} ${pr.headRefName} -> ${pr.baseRefName}`;
      })()
    : "pr: unavailable",
  ghRuns.ok
    ? `latest ci: ${firstNonEmptyLine(ghRuns.stdout) || "no runs found"}`
    : "latest ci: unavailable",
]);

const vercelWhoAmI = run("vercel whoami");
const vercelProjectFile = path.join(cwd, ".vercel", "project.json");
const linkedProject = existsSync(vercelProjectFile)
  ? JSON.parse(readFileSync(vercelProjectFile, "utf8"))
  : null;
const vercelInspectTarget = linkedProject
  ? `${linkedProject.projectName}.vercel.app`
  : null;
const vercelInspect = vercelInspectTarget
  ? run(`vercel inspect ${vercelInspectTarget}`)
  : { ok: false, stdout: "", stderr: "missing .vercel/project.json" };
printSection("vercel", [
  vercelWhoAmI.ok
    ? `auth: connected as ${parseVercelUser(vercelWhoAmI.stdout) || "unknown"}`
    : `auth: unavailable (${firstNonEmptyLine(vercelWhoAmI.stderr || vercelWhoAmI.stdout) || "failed"})`,
  linkedProject
    ? `project: ${linkedProject.projectName} (${linkedProject.projectId})`
    : "project: not linked",
  vercelInspect.ok
    ? `deploy: ${firstNonEmptyLine(vercelInspect.stdout.split("Aliases")[0]) || vercelInspectTarget}`
    : `deploy: unavailable (${firstNonEmptyLine(vercelInspect.stderr || vercelInspect.stdout) || "failed"})`,
]);

const supabaseVersion = run("npx --yes supabase --version");
const supabaseProjects = run("npx --yes supabase projects list");
const supabaseMigrations = run("npx --yes supabase migration list");
const migrationDrift = supabaseMigrations.ok
  ? parseMigrationDrift(supabaseMigrations.stdout)
  : { localOnly: [], remoteOnly: [] };
printSection("supabase", [
  supabaseVersion.ok
    ? `cli: ${parseSupabaseVersion(supabaseVersion.stdout) || "unknown version"}`
    : `cli: unavailable (${firstNonEmptyLine(supabaseVersion.stderr || supabaseVersion.stdout) || "failed"})`,
  supabaseProjects.ok
    ? `project access: ${parseSupabaseLinkedProject(supabaseProjects.stdout) || "available"}`
    : `project access: unavailable (${firstNonEmptyLine(supabaseProjects.stderr || supabaseProjects.stdout) || "failed"})`,
  supabaseMigrations.ok
    ? `migration drift: ${migrationDrift.localOnly.length === 0 && migrationDrift.remoteOnly.length === 0 ? "none" : "detected"}`
    : `migration drift: unavailable (${firstNonEmptyLine(supabaseMigrations.stderr || supabaseMigrations.stdout) || "failed"})`,
  formatList("local-only", migrationDrift.localOnly),
  formatList("remote-only", migrationDrift.remoteOnly),
]);