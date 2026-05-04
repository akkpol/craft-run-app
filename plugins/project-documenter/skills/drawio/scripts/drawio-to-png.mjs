/**
 * drawio-to-png.mjs - Convert .drawio files to PNG with accurate rendering.
 *
 * Rendering priority:
 *   1. draw.io CLI (if installed) - pixel-perfect, fastest
 *   2. Official draw.io viewer JS in headless browser - pixel-perfect, needs network
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import puppeteer from "puppeteer-core";

function buildViewerHtml(rawFileContent) {
  const escaped = rawFileContent
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>* { margin: 0; padding: 0; } body { background: white; }</style></head>
<body>
  <div id="diagram-host"></div>
  <script>
    (function() {
      var raw = \`${escaped}\`;
      var xmlStr = raw.trim();
      if (xmlStr.startsWith('<mxGraphModel')) {
        xmlStr = '<mxfile><diagram name="Page-1">' + xmlStr + '</diagram></mxfile>';
      } else if (!xmlStr.startsWith('<mxfile') && xmlStr.startsWith('<diagram')) {
        xmlStr = '<mxfile>' + xmlStr + '</mxfile>';
      }

      var config = {
        xml: xmlStr,
        highlight: "none",
        nav: false,
        resize: true,
        toolbar: null,
        "toolbar-nohide": true,
        edit: null,
        lightbox: false,
        "auto-fit": true,
        "check-visible-state": false
      };

      var div = document.createElement('div');
      div.className = 'mxgraph';
      div.setAttribute('data-mxgraph', JSON.stringify(config));
      document.getElementById('diagram-host').appendChild(div);
    })();

    window.__pollStarted = false;
    window.__startPoll = function() {
      if (window.__pollStarted) return;
      window.__pollStarted = true;
      if (typeof GraphViewer !== 'undefined' && GraphViewer.processElements) {
        GraphViewer.processElements();
      }
      (function poll() {
        var mxDiv = document.querySelector('.mxgraph');
        if (mxDiv) {
          var svg = mxDiv.querySelector('svg');
          if (svg) {
            var rect = mxDiv.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 10) {
              window.__renderComplete = true;
              window.__renderWidth = rect.width;
              window.__renderHeight = rect.height;
              return;
            }
          }
        }
        setTimeout(poll, 150);
      })();
    };
  </script>
</body>
</html>`;
}

function resolveRenderer(rawArgs) {
  let renderer = "auto";
  const args = [];

  for (const arg of rawArgs) {
    if (arg.startsWith("--renderer=")) {
      renderer = arg.substring("--renderer=".length).trim().toLowerCase();
      continue;
    }
    args.push(arg);
  }

  if (!["auto", "cli", "viewer"].includes(renderer)) {
    throw new Error(`Invalid renderer '${renderer}'. Use auto, cli, or viewer.`);
  }

  return { renderer, args };
}

function findDrawioCliPath() {
  const candidates = [
    process.env.DRAWIO_PATH,
    "C:\\Program Files\\draw.io\\draw.io.exe",
    "C:\\Program Files (x86)\\draw.io\\draw.io.exe",
    "/Applications/draw.io.app/Contents/MacOS/draw.io",
    "/usr/bin/drawio",
    "/usr/local/bin/drawio"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const names = process.platform === "win32" ? ["drawio", "draw.io"] : ["drawio"];

  for (const name of names) {
    const probe = spawnSync(locator, [name], { encoding: "utf-8" });
    if (probe.status === 0 && probe.stdout) {
      const first = probe.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (first) {
        return first;
      }
    }
  }

  return null;
}

function exportWithDrawioCli(drawioPath, input, output) {
  const result = spawnSync(drawioPath, ["-x", "-f", "png", "-e", "-b", "10", "-o", output, input], { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "draw.io CLI failed").trim());
  }
}

async function renderWithViewer(files) {
  const browserPaths = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ].filter(Boolean);

  let executablePath;
  for (const candidate of browserPaths) {
    try {
      if (statSync(candidate).isFile()) {
        executablePath = candidate;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!executablePath) {
    throw new Error("No browser found. Set CHROME_PATH or EDGE_PATH.");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  for (const { input, output } of files) {
    const page = await browser.newPage();
    await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(buildViewerHtml(readFileSync(input, "utf-8")), { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ url: "https://viewer.diagrams.net/js/viewer-static.min.js" });
    await page.evaluate(() => window.__startPoll());
    await page.waitForFunction(() => window.__renderComplete === true, { timeout: 30000 });
    const containerHandle = await page.$(".mxgraph");
    const pngBuffer = containerHandle
      ? await containerHandle.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" });
    writeFileSync(output, pngBuffer);
    await page.close();
  }

  await browser.close();
}

async function main() {
  const { renderer, args } = resolveRenderer(process.argv.slice(2));
  let files = [];

  if (args[0] === "--dir") {
    const dir = resolve(args[1] || ".");
    files = readdirSync(dir)
      .filter((file) => file.endsWith(".drawio"))
      .map((file) => ({
        input: join(dir, file),
        output: join(dir, file.replace(/\.drawio$/, ".drawio.png"))
      }));
  } else if (args[0]) {
    const input = resolve(args[0]);
    files = [{
      input,
      output: args[1] || input.replace(/\.drawio$/, ".drawio.png")
    }];
  } else {
    console.error("Usage: node drawio-to-png.mjs <input.drawio> [output.png]");
    console.error("       node drawio-to-png.mjs --dir <directory>");
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("No .drawio files found.");
    return;
  }

  const drawioCliPath = findDrawioCliPath();
  if (renderer === "cli" || (renderer === "auto" && drawioCliPath)) {
    if (!drawioCliPath) {
      throw new Error("draw.io CLI not found.");
    }
    for (const { input, output } of files) {
      exportWithDrawioCli(drawioCliPath, input, output);
    }
    return;
  }

  await renderWithViewer(files);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
