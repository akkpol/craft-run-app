---
name: drawio
description: Generate draw.io diagrams as .drawio files and export to PNG/SVG/PDF with embedded XML
---

# Draw.io Diagram Skill

Generate draw.io diagrams as native `.drawio` files and export them to PNG images that can be embedded in Word documents.

## How to Create a Diagram

1. Generate draw.io XML in `mxGraphModel` format.
2. Write the XML to a `.drawio` file.
3. Export to PNG using the bundled export script.

## Usage

```bash
cd skills/drawio/scripts && npm install
node skills/drawio/scripts/drawio-to-png.mjs <input.drawio> [output.png]
node skills/drawio/scripts/drawio-to-png.mjs --dir <directory>
node skills/drawio/scripts/drawio-to-png.mjs --renderer=cli|viewer|auto <input.drawio>
```

## Included Files

- `SKILL.md`
- `scripts/drawio-to-png.mjs`
- `scripts/package.json`

## Style Conventions

```xml
<mxCell style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;arcSize=12;shadow=1;" />
<mxCell style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;" />
<mxCell style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" />
<mxCell style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#6c8ebf;strokeWidth=2;" />
```