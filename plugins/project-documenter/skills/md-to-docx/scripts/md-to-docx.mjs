/**
 * md-to-docx.mjs - Markdown to Word converter
 * Pure JavaScript, no external tools required.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { marked } from "marked";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";

function pngDimensions(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  return { width: 600, height: 400 };
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node md-to-docx.mjs <input.md> [output.docx]");
  process.exit(1);
}

const outputPath = process.argv[3] || inputPath.replace(/\.md$/i, ".docx");
const inputDir = dirname(resolve(inputPath));
const mdSource = readFileSync(inputPath, "utf-8");

let title = "Document";
let date = new Date().toISOString().slice(0, 10);
let version = "1.0";
let audience = "";

const fmMatch = mdSource.match(/^---\n([\s\S]*?)\n---/m);
if (fmMatch) {
  const fm = fmMatch[1];
  title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") || title;
  date = fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() || date;
  version = fm.match(/^version:\s*(.+)$/m)?.[1]?.trim() || version;
  audience = fm.match(/^audience:\s*(.+)$/m)?.[1]?.trim() || "";
}

const md = mdSource.replace(/^---[\s\S]*?---\n*/m, "");
const tokens = marked.lexer(md);

const FONT = "Calibri";
const HEADER_COLOR = "1F3864";
const ACCENT_COLOR = "2E75B6";
const TABLE_HEADER_BG = "D6E4F0";
const TABLE_ALT_BG = "F2F7FB";
const CODE_BG = "F5F5F5";
const CODE_FONT = "Consolas";
const BORDER_COLOR = "B4C6E7";

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };

function inlineToRuns(inlineTokens, parentBold = false, parentItalic = false) {
  const runs = [];
  if (!inlineTokens) {
    return runs;
  }

  for (const token of inlineTokens) {
    switch (token.type) {
      case "text":
        runs.push(new TextRun({
          text: decodeEntities(token.text || token.raw || ""),
          bold: parentBold,
          italics: parentItalic,
          font: FONT,
          size: 22
        }));
        break;
      case "strong":
        runs.push(...inlineToRuns(token.tokens, true, parentItalic));
        break;
      case "em":
        runs.push(...inlineToRuns(token.tokens, parentBold, true));
        break;
      case "codespan":
        runs.push(new TextRun({
          text: token.text,
          font: CODE_FONT,
          size: 20,
          bold: parentBold,
          shading: { type: ShadingType.SOLID, color: CODE_BG, fill: CODE_BG }
        }));
        break;
      case "link":
        runs.push(new TextRun({
          text: token.text || token.href,
          bold: parentBold,
          italics: parentItalic,
          font: FONT,
          size: 22,
          color: ACCENT_COLOR,
          underline: {}
        }));
        break;
      case "br":
        runs.push(new TextRun({ break: 1, font: FONT }));
        break;
      default:
        if (token.raw) {
          runs.push(new TextRun({
            text: decodeEntities(token.raw),
            bold: parentBold,
            italics: parentItalic,
            font: FONT,
            size: 22
          }));
        }
        break;
    }
  }

  return runs;
}

function buildTable(token) {
  const rows = [];

  if (token.header) {
    rows.push(new TableRow({
      tableHeader: true,
      children: token.header.map((cell) => new TableCell({
        shading: { type: ShadingType.SOLID, color: TABLE_HEADER_BG, fill: TABLE_HEADER_BG },
        children: [new Paragraph({ children: inlineToRuns(cell.tokens, true) })]
      }))
    }));
  }

  if (token.rows) {
    token.rows.forEach((row, index) => {
      rows.push(new TableRow({
        children: row.map((cell) => new TableCell({
          shading: index % 2 === 1
            ? { type: ShadingType.SOLID, color: TABLE_ALT_BG, fill: TABLE_ALT_BG }
            : undefined,
          children: [new Paragraph({ children: inlineToRuns(cell.tokens) })]
        }))
      }));
    });
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: tableBorder,
      bottom: tableBorder,
      left: tableBorder,
      right: tableBorder,
      insideHorizontal: tableBorder,
      insideVertical: tableBorder
    }
  });
}

const children = [
  new Paragraph({ spacing: { before: 2400 } }),
  new Paragraph({
    children: [new TextRun({ text: title, font: FONT, size: 56, bold: true, color: HEADER_COLOR })],
    alignment: AlignmentType.CENTER
  }),
  new Paragraph({
    children: [new TextRun({ text: `Date: ${date}  |  Version: ${version}`, font: FONT, size: 22 })],
    alignment: AlignmentType.CENTER
  })
];

if (audience) {
  children.push(new Paragraph({
    children: [new TextRun({ text: `Audience: ${audience}`, font: FONT, size: 22 })],
    alignment: AlignmentType.CENTER
  }));
}

children.push(new Paragraph({ children: [new PageBreak()] }));

for (const token of tokens) {
  switch (token.type) {
    case "heading":
      children.push(new Paragraph({
        heading: {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4
        }[token.depth] || HeadingLevel.HEADING_4,
        children: [new TextRun({
          text: decodeEntities(token.text),
          font: FONT,
          bold: true,
          color: token.depth <= 2 ? HEADER_COLOR : ACCENT_COLOR
        })]
      }));
      break;
    case "paragraph": {
      const imageToken = token.tokens && token.tokens.length === 1 && token.tokens[0].type === "image"
        ? token.tokens[0]
        : null;

      if (imageToken) {
        const imagePath = resolve(inputDir, imageToken.href || "");
        if (existsSync(imagePath)) {
          const imageBuffer = readFileSync(imagePath);
          const dimensions = pngDimensions(imageBuffer);
          const maxWidth = 580;
          const scale = dimensions.width > maxWidth ? maxWidth / dimensions.width : 1;
          children.push(new Paragraph({
            children: [new ImageRun({
              data: imageBuffer,
              transformation: {
                width: Math.round(dimensions.width * scale),
                height: Math.round(dimensions.height * scale)
              },
              type: "png"
            })],
            alignment: AlignmentType.CENTER
          }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: `[Image not found: ${imageToken.href}]`, font: FONT, size: 20 })]
          }));
        }
      } else {
        children.push(new Paragraph({ children: inlineToRuns(token.tokens) }));
      }
      break;
    }
    case "table":
      children.push(buildTable(token));
      break;
    case "list":
      token.items.forEach((item, index) => {
        children.push(new Paragraph({
          children: [new TextRun({
            text: `${token.ordered ? `${index + 1}.` : "•"} ${decodeEntities(item.text || "")}`,
            font: FONT,
            size: 22
          })]
        }));
      });
      break;
    case "code":
      children.push(new Paragraph({
        children: [new TextRun({ text: token.text || "", font: CODE_FONT, size: 18 })],
        shading: { type: ShadingType.SOLID, color: CODE_BG, fill: CODE_BG }
      }));
      break;
    default:
      break;
  }
}

const doc = new Document({
  sections: [{ children }]
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log(`Generated: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);