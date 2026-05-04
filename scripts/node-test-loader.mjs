import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const srcRoot = path.join(repoRoot, "src");

async function resolveAliasTarget(specifier) {
  const relativePath = specifier.slice(2).replaceAll("/", path.sep);
  const basePath = path.join(srcRoot, relativePath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep trying other candidate paths.
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const resolvedPath = await resolveAliasTarget(specifier);
  if (!resolvedPath) {
    return nextResolve(specifier, context);
  }

  return nextResolve(pathToFileURL(resolvedPath).href, context);
}