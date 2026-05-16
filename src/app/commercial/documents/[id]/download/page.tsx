import { notFound } from "next/navigation";

import CommercialDocumentPrintPage from "@/components/commercial-document-print-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCommercialDocumentPrintModel } from "@/lib/commercial-document-print";
import CommercialDocumentPrintToolbar from "./print-toolbar";

export const dynamic = "force-dynamic";

type CommercialDocumentRow = {
  id: string;
  status: string | null;
  snapshot_json: unknown;
  payment_id?: string | null;
};

export default async function CommercialDocumentDownloadPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("commercial_documents")
    .select("id, status, snapshot_json, payment_id")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    notFound();
  }

  const printModel = buildCommercialDocumentPrintModel(document as CommercialDocumentRow);

  if (!printModel) {
    notFound();
  }

  // Surface the 50 ทวิ certificate link only when the linked payment has
  // wht_amount > 0. Cheaper than always rendering a dead button.
  let whtCertPaymentId: string | null = null;
  if (document.payment_id) {
    const { data: pay } = await supabase
      .from("payments")
      .select("id, wht_amount")
      .eq("id", document.payment_id)
      .maybeSingle();
    if (pay && Number(pay.wht_amount ?? 0) > 0) {
      whtCertPaymentId = pay.id;
    }
  }

  return (
    <CommercialDocumentPrintPage
      printModel={printModel}
      toolbar={
        <CommercialDocumentPrintToolbar whtCertPaymentId={whtCertPaymentId} />
      }
    />
  );
}