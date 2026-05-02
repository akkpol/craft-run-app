import type { BackofficeSnapshot, SnapshotQuote } from "./backoffice-snapshot";

export function filterCommercialGateQuotes(quotes: SnapshotQuote[]): SnapshotQuote[] {
  return quotes.filter((quote) => {
    const requestedDocumentType = quote.leads?.requested_document_type || null;
    const requiresCommercialDocument =
      requestedDocumentType === "receipt" || requestedDocumentType === "tax_invoice";
    const commercialOrder = quote.commercialOrder || null;
    const hasConfirmedPayment = Boolean(commercialOrder?.confirmedPaymentId);
    const hasReceiverSelection = Boolean(commercialOrder?.selectedReceiverEntityId);
    const hasReceiverLock = Boolean(commercialOrder?.paymentReceiverLockedAt);
    const hasIssuedDocument = Boolean(commercialOrder?.issuedDocumentId);

    if (quote.status !== "approved" || !requiresCommercialDocument) {
      return false;
    }

    return !hasReceiverSelection || (hasConfirmedPayment && (!hasReceiverLock || !hasIssuedDocument));
  });
}

export function getCommercialGateQuotes(snapshot: BackofficeSnapshot): SnapshotQuote[] {
  return filterCommercialGateQuotes(snapshot.quotes);
}