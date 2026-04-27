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