import { existsSync, readFileSync } from "node:fs";

function loadLocalEnvSnapshot() {
  if (process.env.VERCEL === "1" || !existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvSnapshot();

const REQUIRED_ENV = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    why: "Bootstraps Supabase clients and lets /admin/settings load runtime LINE config.",
    placeholder: /your-project/i,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    why: "Bootstraps browser and SSR Supabase clients used by LIFF/admin pages.",
    placeholder: /^sb_publishable_xxx$/i,
  },
  {
    name: "SUPABASE_SECRET_KEY",
    why: "Bootstraps server-only Supabase admin access before app_settings fallback can be read.",
    placeholder: /^sb_secret_xxx$/i,
  },
  {
    name: "LINE_CHANNEL_ACCESS_TOKEN",
    why: "Required for webhook replies, push messages, quote links, status updates, and follow-ups.",
    placeholder: /LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN/i,
  },
  {
    name: "LINE_CHANNEL_SECRET",
    why: "Required to verify LINE webhook signatures.",
    placeholder: /LINE_MESSAGING_API_CHANNEL_SECRET/i,
  },
  {
    name: "LIFF_ID",
    why: "Required to build liff.line.me links and verify LIFF ID tokens.",
    placeholder: /YOUR_LIFF_ID/i,
  },
  {
    name: "NEXT_PUBLIC_LIFF_ID",
    why: "Required for browser-side LIFF init and must match LIFF_ID.",
    placeholder: /YOUR_LIFF_ID/i,
  },
  {
    name: "NEXT_PUBLIC_BASE_URL",
    why: "Required to build webhook, LIFF endpoint, quote, status, and production evidence links.",
    placeholder: /your-app\.vercel\.app/i,
  },
];

const isDeployCheck =
  process.argv.includes("--strict") ||
  process.env.CHECK_LINE_LIFF_ENV === "1" ||
  process.env.CHECK_LINE_LIFF_ENV === "true" ||
  process.env.VERCEL === "1";

function clean(value) {
  return (value || "").trim();
}

function isMissingOrPlaceholder(rule) {
  const value = clean(process.env[rule.name]);
  return !value || rule.placeholder.test(value);
}

const missing = REQUIRED_ENV.filter(isMissingOrPlaceholder);
const adminAllowlist = clean(process.env.ADMIN_ALLOWED_EMAILS);
const adminEmail = clean(process.env.ADMIN_EMAIL);
const adminMissing =
  (!adminAllowlist && !adminEmail) ||
  adminAllowlist === "admin@example.com,ops@example.com" ||
  adminEmail === "admin@example.com";
const liffId = clean(process.env.LIFF_ID);
const publicLiffId = clean(process.env.NEXT_PUBLIC_LIFF_ID);
const liffMismatch = liffId && publicLiffId && liffId !== publicLiffId;

if (!isDeployCheck) {
  console.log(
    "[line-liff-env] Skipping strict deploy env check outside Vercel or an explicit CHECK_LINE_LIFF_ENV run. Use CHECK_LINE_LIFF_ENV=1 to validate locally or in CI."
  );
  process.exit(0);
}

if (missing.length > 0 || adminMissing || liffMismatch) {
  console.error("[line-liff-env] LINE/LIFF deploy config is incomplete. Refusing to build.");

  if (missing.length > 0) {
    console.error("\nMissing or placeholder deployment envs:");
    for (const item of missing) {
      console.error(`- ${item.name}: ${item.why}`);
    }
  }

  if (adminMissing) {
    console.error(
      "\nMissing admin allowlist: set ADMIN_ALLOWED_EMAILS or ADMIN_EMAIL so operators can reach /admin/settings after deploy."
    );
  }

  if (liffMismatch) {
    console.error(
      "\nLIFF mismatch: LIFF_ID and NEXT_PUBLIC_LIFF_ID must be the same value for server token verification and browser LIFF init."
    );
  }

  console.error(
    "\nSet these in Vercel Project Environment Variables for Production, then redeploy. See docs/ENV_AND_LINE_SETUP.md."
  );
  process.exit(1);
}

console.log("[line-liff-env] LINE/LIFF deploy env check passed.");
