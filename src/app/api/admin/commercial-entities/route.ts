import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = ["company", "person"] as const;
const ALLOWED_ROLES = ["MAIN_COMPANY", "SUB_COMPANY", "PERSONAL_ACCOUNT"] as const;
const ALLOWED_BRANCH_TYPES = ["HEAD_OFFICE", "BRANCH"] as const;

type EntityType = (typeof ALLOWED_TYPES)[number];
type EntityRole = (typeof ALLOWED_ROLES)[number];
type EntityBranchType = (typeof ALLOWED_BRANCH_TYPES)[number];

type CreateBody = {
  code?: string;
  type?: string;
  role?: string;
  legalName?: string;
  displayName?: string;
  taxId?: string | null;
  isVatRegistered?: boolean;
  branchType?: string;
  branchCode?: string | null;
  branchName?: string | null;
  address?: string | null;
  bankAccountOwner?: string | null;
};

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function GET() {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("commercial_entities")
    .select(
      "id, code, type, role, legal_name, display_name, tax_id, is_vat_registered, branch_type, branch_code, branch_name, address, bank_account_owner, active, created_at, updated_at"
    )
    .order("active", { ascending: false })
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate required + enums (L20 — admin endpoint still enforces business rules).
  const code = sanitizeText(body.code, 100);
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(body.type as EntityType)) {
    return NextResponse.json(
      {
        error: "ENTITY_TYPE_INVALID",
        detail: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (!ALLOWED_ROLES.includes(body.role as EntityRole)) {
    return NextResponse.json(
      {
        error: "ENTITY_ROLE_INVALID",
        detail: `role must be one of: ${ALLOWED_ROLES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const legalName = sanitizeText(body.legalName, 500);
  const displayName = sanitizeText(body.displayName, 200);
  if (!legalName || !displayName) {
    return NextResponse.json(
      { error: "legalName and displayName are required" },
      { status: 400 }
    );
  }

  // Cross-rule: PERSONAL_ACCOUNT cannot be VAT-registered, MUST be type=person.
  const isVat = Boolean(body.isVatRegistered);
  if (body.role === "PERSONAL_ACCOUNT" && body.type !== "person") {
    return NextResponse.json(
      {
        error: "ROLE_TYPE_MISMATCH",
        detail: "PERSONAL_ACCOUNT role must use type=person.",
      },
      { status: 422 }
    );
  }
  if (body.role === "PERSONAL_ACCOUNT" && isVat) {
    return NextResponse.json(
      {
        error: "ROLE_VAT_MISMATCH",
        detail: "PERSONAL_ACCOUNT cannot be VAT-registered.",
      },
      { status: 422 }
    );
  }
  if ((body.role === "MAIN_COMPANY" || body.role === "SUB_COMPANY") && body.type !== "company") {
    return NextResponse.json(
      {
        error: "ROLE_TYPE_MISMATCH",
        detail: "Company roles must use type=company.",
      },
      { status: 422 }
    );
  }

  // VAT-registered entity must have a tax_id — downstream document issuance
  // emits TAX_INVOICE_RECEIPT only on VAT-registered receivers, and Thai
  // tax invoices require the issuer's 13-digit tax_id. Without this check,
  // admin could create a "VAT-registered but no tax_id" row that silently
  // fails or prints a blank tax line. (L2 — trace downstream of new flag.)
  const taxId = sanitizeText(body.taxId, 50);
  if (isVat && !taxId) {
    return NextResponse.json(
      {
        error: "VAT_ENTITY_REQUIRES_TAX_ID",
        detail: "VAT-registered entity must have a tax_id (เลขประจำตัวผู้เสียภาษี).",
      },
      { status: 422 }
    );
  }

  const branchType = ALLOWED_BRANCH_TYPES.includes(body.branchType as EntityBranchType)
    ? (body.branchType as EntityBranchType)
    : "HEAD_OFFICE";

  const branchCode = sanitizeText(body.branchCode, 50);
  const branchName = sanitizeText(body.branchName, 200);
  // DB has a check constraint: branch_type='HEAD_OFFICE' OR branch_code OR
  // branch_name IS NOT NULL. Catch it in the app so the admin sees a clear
  // error code instead of a 500 with raw Postgres CHECK message.
  if (branchType === "BRANCH" && !branchCode && !branchName) {
    return NextResponse.json(
      {
        error: "BRANCH_REQUIRES_CODE_OR_NAME",
        detail: "BRANCH entries must include either a branch_code or branch_name.",
      },
      { status: 422 }
    );
  }

  const supabase = createAdminClient();
  const { data: inserted, error: insertError } = await supabase
    .from("commercial_entities")
    .insert({
      code,
      type: body.type,
      role: body.role,
      legal_name: legalName,
      display_name: displayName,
      tax_id: taxId,
      is_vat_registered: isVat,
      branch_type: branchType,
      branch_code: branchCode,
      branch_name: branchName,
      address: sanitizeText(body.address, 1000),
      bank_account_owner: sanitizeText(body.bankAccountOwner, 500),
      active: true,
    })
    .select(
      "id, code, type, role, legal_name, display_name, tax_id, is_vat_registered, branch_type, branch_code, branch_name, address, bank_account_owner, active"
    )
    .single();

  if (insertError || !inserted) {
    // Postgres error codes are more reliable than string-matching the message.
    // 23505 = unique_violation, 23514 = check_violation.
    const code23 = (insertError as { code?: string } | null)?.code ?? "";
    if (code23 === "23505") {
      return NextResponse.json(
        {
          error: "ENTITY_CODE_TAKEN",
          detail: `Another entity already uses code ${code}.`,
        },
        { status: 409 }
      );
    }
    if (code23 === "23514") {
      return NextResponse.json(
        {
          error: "ENTITY_CONSTRAINT_VIOLATION",
          detail: insertError?.message || "Check constraint failed.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: insertError?.message || "Failed to create entity" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "system",
    entityId: "commercial_entities",
    actionType: "commercial_entity.created",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      entity_id: inserted.id,
      code: inserted.code,
      role: inserted.role,
      type: inserted.type,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, entity: inserted });
}
