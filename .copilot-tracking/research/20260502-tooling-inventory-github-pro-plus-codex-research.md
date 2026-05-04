<!-- markdownlint-disable-file -->

# Task Research Notes: Tooling Inventory For GitHub Pro+ And Codex Usage

## Research Executed

### File Analysis

- package.json
  - Verified canonical repo scripts: `dev`, `dev:webpack`, `build`, `lint`, `test`, `test:node`, `test:vitest`, `check:line-liff-env`, `check:workflow-policy`, and Vercel Sandbox scripts.
  - Verified repo dependencies include Next.js 16.2.3, React 19.2.5, Supabase client packages, Vercel analytics/speed insights, MCP SDK, Google Stitch SDK, shadcn, Vitest, TypeScript, and Sandbox CLI dev dependency.
- plan/CORE_EXECUTION_TOOLKIT.md
  - Verified project operating contract: one human operator, AI agents for implementation/validation, main plan is `plan/process-go-live-waves-1.md`, canonical policy is `docs/workflow-policy.json`, and every issue follows symptom/evidence/root-cause/fix/validation/closure flow.
- plan/process-anti-loop-execution-1.md
  - Verified mandatory tool matrix: PowerShell 7, `rg`/`fd`, `jq`/`gh`, repo npm scripts, non-interactive git safety, `npx supabase`/`npx vercel`, secrets presence-only checks, optional helpers.
  - Verified guard rules: do not install/upgrade tools mid-lane unless blocked; do not trust old evidence after Node/npm/Supabase/Vercel/shell/git/migration changes; do not deploy/db push/live validate unless explicitly required.
- docs/VERCEL_SANDBOX.md
  - Verified Vercel Sandbox is intended for isolated execution in a Linux microVM and repo scripts exist for help, login, list, Node/Python checks, and locked no-network shell.
- .github/agents/supabase-cli-helper.agent.md
  - Verified custom Supabase CLI helper agent exists for Supabase CLI commands, migrations, local dev, project linking, `db push/pull`, auth/storage setup, and CLI output troubleshooting.
- plugins/fogus-workflow-mcp/.mcp.json
  - Verified a local MCP server named `fogus-workflow` is configured to run `node ./scripts/server.mjs`.
- plugins/fogus-workflow-mcp/.codex-plugin/plugin.json
  - Verified local Codex plugin metadata for `FOGUS Workflow Guard`, described as deterministic workflow checks for workflow decisions and UI scope.
- plugins/fogus-workflow-mcp/scripts/server.mjs
  - Verified MCP tools exposed: `get_workflow_summary`, `get_allowed_actions`, `validate_transition`, and `get_ui_contract`, all sourced from `src/lib/workflow-policy-core.mjs`.
- plugins/supabase/.mcp.json
  - Verified Supabase plugin MCP config is currently empty.
- plugins/supabase/.codex-plugin/plugin.json
  - Verified Supabase Codex plugin metadata is still placeholder/TODO and not ready as a real plugin.
- .agents/plugins/marketplace.json
  - Verified local marketplace references `supabase` and `fogus-workflow-mcp`, but the marketplace metadata itself still contains TODO placeholders.
- VS Code extension inventory
  - Verified `GitHub.codespaces` is installed. Marketplace metadata: GitHub Codespaces, description `Your instant dev environment`, version `1.18.13`, publisher GitHub.

### Code Search Results

- `Codex|codex|Copilot|GitHub Pro|Pro\+|sandbox|Supabase CLI|Vercel CLI|gh |GitHub CLI|MCP|agent|tools`
  - Found project references to prior Codex branch names, GitHub CLI PR commands, MCP removal notes, Supabase CLI follow-up plans, Vercel Sandbox docs, and the Supabase CLI helper agent.
- `mcpServers|Model Context Protocol|fogus-workflow|server.mjs|tools|workflow`
  - Found local workflow MCP server and Codex plugin metadata under `plugins/fogus-workflow-mcp`.
  - Found Supabase plugin shell exists but remains TODO/empty.
- `.copilot-tracking/research/*.md`
  - No existing research notes were present before this file.
- `.github/agents/*.md`
  - Found one custom agent: `supabase-cli-helper.agent.md`.

### External Research

- #fetch:https://docs.github.com/en/copilot/about-github-copilot/what-is-github-copilot
  - GitHub Copilot supports IDE suggestions, chat, command-line help, Spaces, PR description generation, and research/plan/code/PR workflows. Research/plan/code/PR automation is available in Copilot Pro+, Business, and Enterprise.
- #fetch:https://docs.github.com/en/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot
  - Copilot cloud agent is available with Copilot Pro, Pro+, Business, and Enterprise.
  - Cloud agent can research a repository, create implementation plans, fix bugs, implement incremental features, improve tests, update docs, address technical debt, and resolve merge conflicts.
  - Cloud agent works in a GitHub Actions-powered ephemeral environment, can make branch changes, and can optionally open a pull request.
  - Cloud agent differs from IDE agent mode: cloud agent works autonomously on GitHub; IDE agent mode edits the local development environment.
  - Cloud agent can be customized with repository instructions, MCP servers, custom agents, hooks, and skills.
  - Limitations include one repository/branch/PR per assigned task and possible repository policy/ruleset blockers.
- #fetch:https://developers.openai.com/codex/cli/
  - Codex CLI is a local terminal coding agent. It can inspect a repository, edit files, and run commands in the selected directory.
  - Install command is `npm i -g @openai/codex`; first run prompts sign-in with ChatGPT account or API key.
  - ChatGPT Plus, Pro, Business, Edu, and Enterprise plans include Codex access.
  - Windows support exists; PowerShell native sandbox or WSL2 is recommended depending on Linux-native needs.
- #fetch:https://github.com/openai/codex
  - OpenAI Codex repository describes Codex CLI as a lightweight local terminal coding agent.
  - Install options include `npm install -g @openai/codex`, Homebrew cask, or platform binary from GitHub releases.
  - Recommended authentication is Sign in with ChatGPT for Plus/Pro/Business/Edu/Enterprise plans; API-key mode is also available with additional setup.
- #fetch:https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces
  - GitHub Codespaces extension provides cloud-hosted development environments for long-term project work or short-term tasks such as PR review.
  - The extension connects Codespaces from VS Code or a browser-based editor and is listed as Universal/Web compatible.
  - Marketplace metadata verified version `1.18.13`, publisher GitHub, description `Your instant dev environment`.
- #fetch:https://docs.github.com/en/codespaces/overview
  - A codespace is a cloud-hosted development environment backed by a Docker container running on a virtual machine.
  - Codespaces default to an Ubuntu Linux environment, can be customized with dev container configuration, and can be opened from browser, VS Code, or GitHub CLI.
  - Personal GitHub accounts include a monthly free quota; additional usage depends on billing/spending limits.

### Project Conventions

- Standards referenced: `plan/CORE_EXECUTION_TOOLKIT.md`, `plan/process-anti-loop-execution-1.md`, `docs/VERCEL_SANDBOX.md`, `.github/agents/supabase-cli-helper.agent.md`
- Instructions followed: one active packet, worktree check before coding, impacted-surface validation first, no broad deploy/db push/live validation without packet authority, secrets presence-only checks, repo npm scripts as canonical validation interface.

## Key Discoveries

### Project Structure

The project already has a layered tool structure:

- Local development and validation: npm scripts in `package.json`.
- Cloud/deploy/database CLIs: Supabase CLI and Vercel CLI available through repo/global commands.
- Safe isolated execution: Vercel Sandbox CLI installed as a repo dev dependency.
- GitHub automation: GitHub CLI installed, but no `gh` extensions are installed.
- Remote/cloud development: GitHub Codespaces VS Code extension is installed and can provide a repeatable cloud Linux dev environment for branch or PR work.
- Agent specialization: one custom GitHub agent exists for Supabase CLI workflows.
- MCP/plugin direction: local `fogus-workflow-mcp` is implemented; Supabase plugin is only a placeholder.

### Implementation Patterns

Verified terminal inventory from repo root:

- Node: `v24.15.0`
- npm: `11.12.1`
- Supabase CLI via repo: `2.95.6`
- Vercel CLI: `53.1.0`
- Vercel Sandbox via repo: `2.5.10`
- GitHub CLI: `2.90.0`
- GitHub CLI extensions: none installed
- VS Code GitHub Codespaces extension: installed, Marketplace version `1.18.13`
- `codex` command: not found in PATH during research
- Required discovery tools present: `rg`, `fd`, `jq`, `gh`, `node`, `npm`, `vercel`, `code`

Codex status interpretation:

- The local Codex CLI is not currently installed or not on PATH.
- The project does contain Codex plugin metadata under `plugins/`, so Codex can become more useful after CLI installation/auth and plugin activation.
- User may still have Codex access through ChatGPT/Codex Web based on plan, but this research only verified local CLI availability.

### Complete Examples

```powershell
# Safe repo-root inventory commands used or recommended
Set-Location 'D:\copilot_vscode_proplus\craft-run-app'
node -v
npm -v
npm exec supabase -- --version
npm exec vercel -- --version
npm exec sandbox -- --version
gh --version | Select-Object -First 1
gh extension list
Get-Command codex,gh,rg,fd,jq,node,npm,vercel,supabase,sandbox,code -ErrorAction SilentlyContinue
```

```bash
# Codex CLI install path from official docs, not executed during research
npm i -g @openai/codex
codex
```

```bash
# Repo sandbox scripts verified in package.json
npm run sandbox:help
npm run sandbox:login
npm run sandbox:list
npm run sandbox:node
npm run sandbox:python
npm run sandbox:locked
```

### API and Schema Documentation

No application API/schema changes were researched for implementation in this pass. Tooling-relevant contracts found:

- `fogus-workflow-mcp` exposes workflow-policy tools through MCP:
  - `get_workflow_summary`
  - `get_allowed_actions`
  - `validate_transition`
  - `get_ui_contract`
- Supabase CLI helper agent defines a safe command workflow:
  - confirm objective
  - run smallest safe command first, such as `npx supabase --help`
  - interpret output
  - recommend next commands
  - avoid destructive database commands without explicit user request

### Configuration Examples

```json
{
  "mcpServers": {
    "fogus-workflow": {
      "command": "node",
      "args": ["./scripts/server.mjs"]
    }
  }
}
```

```json
{
  "scripts": {
    "build": "next build",
    "test": "node scripts/run-tests.mjs",
    "lint": "eslint .",
    "check:line-liff-env": "node scripts/check-line-liff-env.mjs --strict",
    "check:workflow-policy": "node scripts/workflow-policy-smoke.mjs",
    "sandbox:locked": "sandbox create --runtime node24 --timeout 30m --network-policy deny-all --connect"
  }
}
```

### Technical Requirements

- Keep repo npm scripts as the canonical validation interface.
- Prefer `rg`/`fd` for search and `jq` for JSON inspection.
- Use GitHub CLI for PR/issue/repository context only when needed and without leaking secrets.
- Use Supabase and Vercel CLIs only inside the active packet scope; no broad `db push`, deploy, production migration, or live validation without explicit packet authority.
- Use Vercel Sandbox for untrusted commands, generated code experiments, dependency-risk probes, or isolated build/debug runs.
- Use GitHub Codespaces for cloud-hosted branch/PR work that benefits from a repeatable Linux environment, especially when local Windows shell/path differences may distract from the actual code task.
- Install/enable Codex CLI only as a tooling task, not mid-feature, because installing tools mid-lane violates the anti-loop protocol unless the lane is blocked.
- Treat `fogus-workflow-mcp` as a high-value guard rail for workflow-state and UI-CTA decisions once integrated with the active agent runtime.

## Recommended Approach

Use a five-layer tool strategy:

1. Primary local owner loop: GitHub Copilot in VS Code for repo reading, scoped edits, validation, and handoff notes. This is best for work requiring direct awareness of the dirty worktree, local terminal state, and project protocols.
2. GitHub Copilot cloud agent: use for isolated GitHub Issues or well-scoped backlog tasks that can create a branch/PR independently, especially docs cleanup, tests, small refactors, and non-overlapping feature lanes. Do not use it for tasks requiring local secrets, live operator validation, or multi-packet coordination.
3. GitHub Codespaces: use as a repeatable cloud Linux workspace for branch/PR review, clean-environment validation, or work that should not depend on the local Windows machine. It is not a replacement for production/live validation and should still obey one-packet scope.
4. Codex CLI: install and authenticate as a separate tooling slice, then use for terminal-native parallel research, local code review, and experiments. Since `codex` is not currently in PATH, do not assume it is ready for current packet execution.
5. Specialized repo tools: always keep validation and environment-sensitive work grounded in repo tools: npm scripts, Supabase CLI helper agent, Vercel CLI, Vercel Sandbox, GitHub Codespaces, and `fogus-workflow-mcp`.

This approach avoids treating GitHub Pro+, Codespaces, and Codex as interchangeable. Copilot cloud agent is best for GitHub-side branch/PR automation; Copilot in VS Code is best for live local ownership; Codespaces is best for clean cloud development environments; Codex CLI becomes useful after installation/auth for local terminal agent work; MCP/Sandbox/CLIs provide guard rails and validation.

## Implementation Guidance

- **Objectives**: Turn the available GitHub Pro+ and Codex-era tooling into a disciplined workflow that increases throughput without violating project gates.
- **Key Tasks**: Install/verify Codex CLI in a separate tooling pass; verify Codespaces creation/opening flow when cloud dev is needed; activate/use `fogus-workflow-mcp` for workflow-sensitive work; keep Supabase plugin marked as placeholder until implemented; use Copilot cloud agent only for isolated GitHub-side tasks; keep VS Code Copilot as the primary owner for active packet work.
- **Dependencies**: GitHub Copilot Pro+ access, ChatGPT/Codex access, GitHub Codespaces quota/billing availability, GitHub CLI auth, repo npm dependencies, Vercel/Supabase CLI auth when packet-authorized, Vercel Sandbox login if isolated execution is needed.
- **Success Criteria**: Tool inventory stays current; no unintended installs during feature lanes; Codex CLI availability is explicitly verified before use; Codespaces work is scoped to one branch/packet; cloud-agent tasks are one-branch/one-packet; local validations are recorded with stale-when conditions; no secrets are printed in terminal or research notes.