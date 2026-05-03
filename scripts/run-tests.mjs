import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const testsDir = path.join(repoRoot, "tests");
const vitestBin = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const nodeTestRegister = pathToFileURL(path.join(scriptDir, "register-node-test-loader.mjs")).href;
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")));
const requestedTests = rawArgs
  .filter((arg) => !arg.startsWith("--"))
  .map((arg) => arg.split(path.sep).join("/"));

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function matchesRequestedTests(testFile) {
  if (requestedTests.length === 0) {
    return true;
  }

  return requestedTests.some(
    (requestedTest) =>
      testFile === requestedTest ||
      testFile.endsWith(`/${requestedTest}`) ||
      testFile.includes(requestedTest)
  );
}

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

      return [toPosixPath(path.relative(repoRoot, absolutePath))];
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

const discoveredTests = (await collectTestFiles(testsDir)).filter(matchesRequestedTests);
const { nodeFiles, vitestFiles } = await classifyTestFiles(discoveredTests);

if (discoveredTests.length === 0) {
  console.error(
    requestedTests.length > 0
      ? `No test files matched: ${requestedTests.join(", ")}`
      : "No test files found under tests/"
  );
  process.exit(1);
}

let exitCode = 0;

if (!flags.has("--vitest-only") && nodeFiles.length > 0) {
  console.log(`\n[run-tests] Running node:test files (${nodeFiles.length})`);
  exitCode = Math.max(
    exitCode,
    await runCommand(process.execPath, [
      "--import",
      nodeTestRegister,
      "--test",
      ...nodeFiles,
    ])
  );
}

if (!flags.has("--node-only") && vitestFiles.length > 0) {
  console.log(`\n[run-tests] Running Vitest files (${vitestFiles.length})`);
  exitCode = Math.max(
    exitCode,
    await runCommand(process.execPath, [vitestBin, "run", ...vitestFiles])
  );
}

process.exit(exitCode);