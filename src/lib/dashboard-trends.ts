import { createAdminClient } from "@/lib/supabase/admin";

export type DashboardTrendPoint = {
  date: string;
  newLeads: number;
  newQuotes: number;
  newJobs: number;
  completedJobs: number;
  issuedDocuments: number;
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function toBangkokDateKey(iso: string): string {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatted;
}

function buildDateRange(days: number): { start: Date; keys: string[] } {
  const now = new Date();
  const bangkokToday = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  bangkokToday.setUTCHours(0, 0, 0, 0);
  const keys: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(bangkokToday);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }

  const bangkokStart = new Date(bangkokToday);
  bangkokStart.setUTCDate(bangkokStart.getUTCDate() - (days - 1));
  const start = new Date(bangkokStart.getTime() - BANGKOK_OFFSET_MS);

  return { start, keys };
}

function tallyByDate(
  rows: Array<{ created_at?: string | null; updated_at?: string | null }>,
  field: "created_at" | "updated_at"
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const ts = row[field];
    if (!ts) continue;
    const key = toBangkokDateKey(ts);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export async function getDashboardTrends(days = 7): Promise<DashboardTrendPoint[]> {
  const supabase = createAdminClient();
  const { start, keys } = buildDateRange(days);
  const startIso = start.toISOString();

  const [leadsRes, quotesRes, jobsCreatedRes, jobsCompletedRes, documentsRes] =
    await Promise.all([
      supabase.from("leads").select("created_at").gte("created_at", startIso),
      supabase.from("quotes").select("created_at").gte("created_at", startIso),
      supabase.from("jobs").select("created_at").gte("created_at", startIso),
      supabase
        .from("jobs")
        .select("updated_at, status")
        .eq("status", "COMPLETED")
        .gte("updated_at", startIso),
      supabase
        .from("commercial_documents")
        .select("issued_at")
        .gte("issued_at", startIso),
    ]);

  const leadsByDate = tallyByDate(leadsRes.data ?? [], "created_at");
  const quotesByDate = tallyByDate(quotesRes.data ?? [], "created_at");
  const jobsCreatedByDate = tallyByDate(jobsCreatedRes.data ?? [], "created_at");
  const jobsCompletedByDate = tallyByDate(jobsCompletedRes.data ?? [], "updated_at");
  const documentsByDate = tallyByDate(
    (documentsRes.data ?? []).map((d: { issued_at: string | null }) => ({
      created_at: d.issued_at,
    })),
    "created_at"
  );

  return keys.map((date) => ({
    date,
    newLeads: leadsByDate.get(date) ?? 0,
    newQuotes: quotesByDate.get(date) ?? 0,
    newJobs: jobsCreatedByDate.get(date) ?? 0,
    completedJobs: jobsCompletedByDate.get(date) ?? 0,
    issuedDocuments: documentsByDate.get(date) ?? 0,
  }));
}
