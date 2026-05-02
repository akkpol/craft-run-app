import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const TARGET_LEAD_ID = "cdb07254-a520-473b-bc01-9814570ecddc";
const TARGET_QUOTE_TOKEN = "c21fa1da7c9a48942992384358966098";

function toDataUrl(source) {
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

const nextServerModuleUrl = toDataUrl(`
  export class NextRequest {}
  export const NextResponse = {
    json(body, init = {}) {
      return {
        status: init.status ?? 200,
        body,
        async json() {
          return body;
        },
      };
    },
  };
`);

const adminModuleUrl = toDataUrl(`
  export function createAdminClient() {
    return globalThis.__routeRegressionAdminClient;
  }
`);

const typesModuleUrl = toDataUrl(`
  const statuses = new Set(["preview_sent", "approved", "revision_requested", "drafting", "not_started"]);

  export function isDesignStatus(value) {
    return statuses.has(value);
  }

  export function designStatusNeedsCustomerResponse(value) {
    return value === "preview_sent";
  }
`);

const actionLogModuleUrl = toDataUrl(`
  export async function logHumanAction() {
    return null;
  }
`);

const utilsModuleUrl = toDataUrl(`
  export function getSupabaseHost() {
    return "supabase.test";
  }
`);

const quoteWorkflowModuleUrl = toDataUrl(`
  export async function approveQuote() {
    return { success: true };
  }
`);

async function loadRouteModule(relativePath) {
  const routeUrl = new URL(relativePath, import.meta.url);
  let source = await readFile(routeUrl, "utf8");

  for (const [specifier, replacement] of Object.entries({
    '"next/server"': JSON.stringify(nextServerModuleUrl),
    '"@/lib/supabase/admin"': JSON.stringify(adminModuleUrl),
    '"@/lib/types"': JSON.stringify(typesModuleUrl),
    '"@/lib/action-log"': JSON.stringify(actionLogModuleUrl),
    '"@/lib/utils"': JSON.stringify(utilsModuleUrl),
    '"@/lib/quote-workflow"': JSON.stringify(quoteWorkflowModuleUrl),
  })) {
    source = source.replaceAll(specifier, replacement);
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(toDataUrl(transpiled.outputText));
}

function createSupabaseClient(resultsByTable) {
  return {
    from(table) {
      const configured = resultsByTable[table] ?? {};

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        update() {
          return this;
        },
        async single() {
          return configured.single ?? { data: null, error: null };
        },
        async maybeSingle() {
          return configured.maybeSingle ?? { data: null, error: null };
        },
        async insert() {
          return { data: null, error: null };
        },
      };
    },
  };
}

function createRequest(url, body) {
  const parsedUrl = new URL(url);
  return {
    nextUrl: parsedUrl,
    headers: new Headers({ host: parsedUrl.host }),
    async json() {
      return body;
    },
  };
}

async function withConsoleErrorSpy(callback) {
  const calls = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    calls.push(args);
  };

  try {
    await callback(calls);
  } finally {
    console.error = originalConsoleError;
    delete globalThis.__routeRegressionAdminClient;
  }
}

const publicQuoteRoute = await loadRouteModule("../src/app/api/quotes/public/[token]/route.ts");
const designStatusRoute = await loadRouteModule("../src/app/api/leads/[id]/design-status/route.ts");

test("public quote route returns 404 when quote exists but lead relation is missing", async () => {
  globalThis.__routeRegressionAdminClient = createSupabaseClient({
    quotes: {
      single: {
        data: {
          id: "quote-1",
          lead_id: TARGET_LEAD_ID,
          status: "sent",
          public_token: TARGET_QUOTE_TOKEN,
          payment_terms: "credit",
          payment_status: "pending",
          leads: null,
          jobs: null,
        },
        error: null,
      },
    },
  });

  await withConsoleErrorSpy(async (calls) => {
    const response = await publicQuoteRoute.POST(
      createRequest(`https://example.com/api/quotes/public/${TARGET_QUOTE_TOKEN}`, {
        action: "approve_quote",
      }),
      { params: Promise.resolve({ token: TARGET_QUOTE_TOKEN }) }
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Lead not found" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "Public quote action missing lead relation:");
    assert.equal(calls[0][1].quoteId, "quote-1");
    assert.equal(calls[0][1].quoteLeadId, TARGET_LEAD_ID);
  });
});

test("design-status route returns 404 when lead lookup fails", async () => {
  globalThis.__routeRegressionAdminClient = createSupabaseClient({
    leads: {
      single: {
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: null,
        },
      },
    },
  });

  await withConsoleErrorSpy(async (calls) => {
    const response = await designStatusRoute.POST(
      createRequest(`https://example.com/api/leads/${TARGET_LEAD_ID}/design-status`, {
        designStatus: "drafting",
        note: "retry",
      }),
      { params: Promise.resolve({ id: TARGET_LEAD_ID }) }
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Lead not found" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "Lead design-status lookup failed:");
    assert.equal(calls[0][1].leadId, TARGET_LEAD_ID);
    assert.equal(calls[0][1].leadError.code, "PGRST116");
  });
});