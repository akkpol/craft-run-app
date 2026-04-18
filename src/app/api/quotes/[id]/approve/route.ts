import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveQuote,
} from "@/lib/quote-workflow";

// Next.js 16: async params
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = createAdminClient();

  // 1. Find quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, leads(conversation_id), jobs(id)")
    .eq("id", id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  try {
    const result = await approveQuote(supabase, quote);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to approve quote" },
      { status: 500 }
    );
  }
}
