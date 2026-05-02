Use the installed `gpt-image-2` skill only when the user explicitly asks for GPT Image 2, ChatGPT Images 2.0, or a local/reference-image remix workflow.

In this repository, treat `gpt-image-2` as a local design-assist path for Studio and design-preview exploration, not as a production runtime provider.

When working on Studio or design preview tasks:
- Prefer `/studio` as the handoff surface for design-preview exploration.
- Keep `src/lib/ai-images.ts` and `src/app/api/leads/[id]/ai-preview/route.ts` on the deployed server-provider path unless the user explicitly asks to redesign runtime AI provider architecture.
- Do not replace the OpenAI API provider with the local Codex-based `gpt-image-2` flow.
- If the user wants the local Image 2 path for a lead, prefer the repo wrapper `scripts/invoke-gpt-image-2.ps1` and the guide in `docs/LOCAL_GPT_IMAGE_2_STUDIO_WORKFLOW.md`.

When editing Studio surfaces:
- Preserve workflow-policy behavior and do not invent new design states.
- Keep `/admin` as fallback for operational actions.
- Use the existing `LeadAiPreviewActions` handoff UI for prompt-copy and local command-copy behavior instead of calling local Codex tooling from server routes.

Before starting any new implementation pass in this repository:
- Inspect the current git worktree and classify `staged`, `unstaged`, and `untracked` changes.
- If the worktree spans more than one packet or surface area, treat the repo as unstable and do not continue broad implementation.
- In an unstable worktree, first choose one coherent slice to continue and explicitly defer, quarantine, or clean up the others.
- Do not reopen a packet marked complete unless the user explicitly asks for follow-up on that packet.
- Use `docs/START_HERE_CONTEXT_RECOVERY.md` and `plan/process-anti-loop-execution-1.md` as the recovery gate before resuming work after context drift.