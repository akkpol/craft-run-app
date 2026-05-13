import { notFound } from "next/navigation";

import CommercialDocumentPrintPage from "@/components/commercial-document-print-page";
import { buildCommercialDocumentPrintModel } from "@/lib/commercial-document-print";
import { createAdminClient } from "@/lib/supabase/admin";

import CustomerCommercialDocumentPrintToolbar from "./print-toolbar";

export const dynamic = "force-dynamic";

type CommercialDocumentRow = {
  id: string;
  status: string | null;
  snapshot_json: unknown;
  quote_id: string | null;
};

export default async function CustomerCommercialDocumentPage(props: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await props.params;
  const supabase = createAdminClient();

  const { data: document } = await supabase
    .from("commercial_documents")
    .select("id, status, snapshot_json, quote_id")
    .eq("id", id)
    .maybeSingle();

  if (!document?.quote_id) {
    notFound();
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("public_token")
    .eq("id", document.quote_id)
    .maybeSingle();

  if (!quote?.public_token || quote.public_token !== token) {
    notFound();
  }

  const printModel = buildCommercialDocumentPrintModel(document as CommercialDocumentRow);

  if (!printModel) {
    notFound();
  }

  return (
    <CommercialDocumentPrintPage
      printModel={printModel}
      toolbar={<CustomerCommercialDocumentPrintToolbar statusHref={`/status/${token}`} />}
    />
  );
}
