import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const testsDir = path.join(repoRoot, "tests");
const vitestBin = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const flags = new Set(process.argv.slice(2));

async function collectTestFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(absolutePath);
      }

      if (!/\.test\.(?:[cm]?js|ts)$/.test(entry.name)) {
        return [];
      }

      return [path.relative(repoRoot, absolutePath)];
    })
  );

  return files.flat().sort();
}

async function classifyTestFiles(testFiles) {
  const nodeFiles = [];
  const vitestFiles = [];

  for (const testFile of testFiles) {
    const source = await readFile(path.join(repoRoot, testFile), "utf8");

    if (source.includes('from "vitest"') || source.includes("from 'vitest'")) {
      vitestFiles.push(testFile);
      continue;
    }

    nodeFiles.push(testFile);
  }

  return { nodeFiles, vitestFiles };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited from signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

const discoveredTests = await collectTestFiles(testsDir);
const { nodeFiles, vitestFiles } = await classifyTestFiles(discoveredTests);

if (discoveredTests.length === 0) {
  console.error("No test files found under tests/");
  process.exit(1);
}

let exitCode = 0;

if (!flags.has("--vitest-only") && nodeFiles.length > 0) {
  console.log(`\n[run-tests] Running node:test files (${nodeFiles.length})`);
  exitCode = Math.max(exitCode, await runCommand(process.execPath, ["--test", ...nodeFiles]));
}

if (!flags.has("--node-only") && vitestFiles.length > 0) {
  console.log(`\n[run-tests] Running Vitest files (${vitestFiles.length})`);
  exitCode = Math.max(
    exitCode,
    await runCommand(process.execPath, [vitestBin, "run", ...vitestFiles])
  );
}

process.exit(exitCode);