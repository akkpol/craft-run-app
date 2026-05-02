---
name: md-to-docx
description: Convert Markdown files to professionally formatted Word (.docx) documents with embedded PNG images - pure JavaScript, no external tools required
---

# Markdown to Word (.docx) Skill

Convert Markdown files into professionally formatted Word documents with embedded PNG images.

## Usage

```bash
cd skills/md-to-docx/scripts && npm install
node skills/md-to-docx/scripts/md-to-docx.mjs <input.md> [output.docx]
```

If `output.docx` is omitted, the script writes `<input-basename>.docx`.

## Included Files

- `SKILL.md`
- `scripts/md-to-docx.mjs`
- `scripts/package.json`

## Features

- parses YAML front matter for title metadata
- embeds PNG images referenced in Markdown
- generates a title page and table of contents
- uses pure JavaScript via `docx` and `marked`