import { NextRequest, NextResponse } from "next/server";

import { isAdminEmailAllowed } from "@/lib/admin-access";
import { verifyLiffIdToken } from "@/lib/line";

/**
 * POST /api/test-mode/check
 *
 * Decides whether the LIFF scenario picker should be visible to the current
 * client. The picker is only shown when:
 *   - NODE_ENV !== "production" (any non-prod env), OR
 *   - The caller proves their LINE identity via a LIFF ID token AND that
 *     identity's email is in ADMIN_ALLOWED_EMAILS.
 *
 * The route only returns a boolean — it never echoes admin emails or token
 * payloads back to the client, so a curious customer cannot enumerate the
 * allowlist by probing this endpoint.
 */

type CheckBody = {
  liffIdToken?: string;
};

export async function POST(request: NextRequest) {
  // Non-production environments always allow test mode — useful for localhost
  // dev and Vercel preview deploys.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({ enabled: true, reason: "non_production" });
  }

  let body: CheckBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ enabled: false, reason: "invalid_json" });
  }

  const idToken = body.liffIdToken?.trim();

  if (!idToken) {
    return NextResponse.json({ enabled: false, reason: "missing_id_token" });
  }

  try {
    const identity = await verifyLiffIdToken(idToken);

    if (!identity.email) {
      return NextResponse.json({ enabled: false, reason: "no_email_claim" });
    }

    const allowed = isAdminEmailAllowed(identity.email);

    return NextResponse.json({
      enabled: allowed,
      reason: allowed ? "admin_email" : "not_allowlisted",
    });
  } catch {
    // Token verification failures (expired, wrong client_id, network) are
    // treated as "not allowed" to fail closed.
    return NextResponse.json({ enabled: false, reason: "verify_failed" });
  }
}
