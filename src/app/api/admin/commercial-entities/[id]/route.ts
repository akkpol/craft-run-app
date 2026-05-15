import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_BRANCH_TYPES = ["HEAD_OFFICE", "BRANCH"] as const;
type EntityBranchType = (typeof ALLOWED_BRANCH_TYPES)[number];

type PatchBody = {
  legalName?: string;
  displayName?: string;
  taxId?: string | null;
  isVatRegistered?: boolean;
  branchType?: string;
  branchCode?: string | null;
  branchName?: string | null;
  address?: string | null;
  bankAccountOwner?: string | null;
  active?: boolean;
};

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: PatchBody;
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

  const supabase = createAdminClient();
  // Read current entity to enforce cross-row business rules (L20).
  const { data: current, error: currentErr } = await supabase
    .from("commercial_entities")
    .select("id, type, role, is_vat_registered")
    .eq("id", id)
    .maybeSingle();
  if (currentErr) {
    return NextResponse.json({ error: currentErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.legalName !== undefined) {
    const v = sanitizeText(body.legalName, 500);
    if (!v) {
      return NextResponse.json({ error: "legalName cannot be empty" }, { status: 400 });
    }
    update.legal_name = v;
  }
  if (body.displayName !== undefined) {
    const v = sanitizeText(body.displayName, 200);
    if (!v) {
      return NextResponse.json({ error: "displayName cannot be empty" }, { status: 400 });
    }
    update.display_name = v;
  }
  if (body.taxId !== undefined) update.tax_id = sanitizeText(body.taxId, 50);
  if (body.branchCode !== undefined) update.branch_code = sanitizeText(body.branchCode, 50);
  if (body.branchName !== undefined) update.branch_name = sanitizeText(body.branchName, 200);
  if (body.address !== undefined) update.address = sanitizeText(body.address, 1000);
  if (body.bankAccountOwner !== undefined)
    update.bank_account_owner = sanitizeText(body.bankAccountOwner, 500);

  if (body.branchType !== undefined) {
    if (!ALLOWED_BRANCH_TYPES.includes(body.branchType as EntityBranchType)) {
      return NextResponse.json(
        { error: "branchType must be HEAD_OFFICE or BRANCH" },
        { status: 400 }
      );
    }
    update.branch_type = body.branchType;
  }

  if (body.isVatRegistered !== undefined) {
    // Cross-rule: PERSONAL_ACCOUNT cannot become VAT-registered.
    if (current.role === "PERSONAL_ACCOUNT" && body.isVatRegistered) {
      return NextResponse.json(
        {
          error: "ROLE_VAT_MISMATCH",
          detail: "PERSONAL_ACCOUNT cannot be VAT-registered.",
        },
        { status: 422 }
      );
    }
    update.is_vat_registered = Boolean(body.isVatRegistered);
  }

  if (body.active !== undefined) {
    update.active = Boolean(body.active);
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("commercial_entities")
    .update(update)
    .eq("id", id)
    .select(
      "id, code, type, role, legal_name, display_name, tax_id, is_vat_registered, branch_type, branch_code, branch_name, address, bank_account_owner, active"
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  await logHumanAction(supabase, {
    entityType: "system",
    entityId: "commercial_entities",
    actionType: "commercial_entity.updated",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      entity_id: id,
      changed_fields: Object.keys(update).filter((k) => k !== "updated_at"),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, entity: updated });
}
