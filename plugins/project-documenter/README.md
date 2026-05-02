# Project Documenter Plugin

Local vendored copy of the `project-documenter` plugin from `github/awesome-copilot`.

This plugin generates:

1. `docs/project-summary.md`
2. `docs/diagrams/*.drawio`
3. `docs/diagrams/*.drawio.png`
4. `docs/project-summary.docx`

It is vendored here to avoid upstream plugin resolver failures such as:

`Plugin source directory 'plugins/project-documenter' not found in repository 'github/awesome-copilot'`

## Local Source

Use the local marketplace entry in `.agents/plugins/marketplace.json`.

## Included Components

- Agent: `agents/project-documenter.md`
- Skill: `skills/drawio`
- Skill: `skills/md-to-docx`