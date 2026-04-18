import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createProductionSubmission } from "@/lib/production-media";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  const formData = await request.formData();
  const eventType = String(formData.get("eventType") || "");
  const note = String(formData.get("note") || "");
  const submittedByLabel = String(formData.get("submittedByLabel") || "");
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  try {
    const result = await createProductionSubmission({
      supabase: createAdminClient(),
      token,
      eventType,
      note,
      submittedByLabel,
      files,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create production submission";
    const status =
      /disabled/i.test(message)
        ? 409
        : /invalid|expired|required|allowed/i.test(message)
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
