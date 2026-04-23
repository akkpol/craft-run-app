import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Customer360Client from "./customer-360-client";

export const dynamic = "force-dynamic";

export default async function Customer360Page(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = createAdminClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, line_user_id, display_name, phone, created_at")
    .eq("id", id)
    .single();

  if (error || !customer) {
    notFound();
  }

  const [{ data: conversations }, { data: leads }, { data: quotes }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id, state, last_message_at, created_at")
        .eq("line_user_id", customer.line_user_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("leads")
        .select(
          "id, product_type, width_mm, height_mm, qty, status, due_date, note_from_form, created_at"
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("quotes")
        .select(
          `id, total, status, created_at,
           leads!inner(customer_id),
           jobs(id, status, created_at)`
        )
        .eq("leads.customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const approvedQuotes = (quotes ?? []).filter((q) => q.status === "approved");
  const totalRevenue = approvedQuotes.reduce(
    (sum: number, q: { total?: number | null }) => sum + (Number(q.total) || 0),
    0
  );
  const allJobs = (quotes ?? []).flatMap((q) =>
    Array.isArray(q.jobs) ? q.jobs : []
  );

  const summary = {
    totalOrders: approvedQuotes.length,
    totalRevenue,
    completedJobs: allJobs.filter((j) => j.status === "COMPLETED").length,
    activeJobs: allJobs.filter(
      (j) => j.status !== "COMPLETED" && j.status !== "CANCELLED"
    ).length,
  };

  return (
    <Customer360Client
      customer={customer}
      conversations={conversations ?? []}
      leads={leads ?? []}
      quotes={quotes ?? []}
      summary={summary}
    />
  );
}
