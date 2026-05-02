import { createAdminClient } from "./supabase/admin";
import type {
  CommercialOrderReceiverState,
  CommercialReceiverEntityOption,
  CommercialReceiverRole,
} from "./commercial-receiver-ui";

export type CommercialAdminContext = {
  receiverEntities: CommercialReceiverEntityOption[];
  orderByQuoteId: Record<string, CommercialOrderReceiverState>;
};

type CommercialEntityRow = {
  id: string;
  legal_name: string | null;
  display_name: string | null;
  role: CommercialReceiverRole;
  is_vat_registered: boolean | null;
  active: boolean | null;
};

type CommercialOrderRow = {
  id: string;
  quote_id: string;
  selected_receiver_entity_id: string | null;
  payment_receiver_locked_at: string | null;
  customer_tax_profile_id: string | null;
};

type PaymentRow = {
  id: string;
  order_id: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

type CommercialDocumentRow = {
  id: string;
  order_id: string;
  payment_id: string | null;
  document_type: string;
  document_number: string;
  status: string;
  issued_at: string | null;
  created_at: string;
};

export async function fetchCommercialAdminContextForQuoteIds(
  quoteIds: string[]
): Promise<CommercialAdminContext> {
  const uniqueQuoteIds = [...new Set(quoteIds.filter(Boolean))];
  const supabase = createAdminClient();

  const entitiesQuery = supabase
    .from("commercial_entities")
    .select("id, legal_name, display_name, role, is_vat_registered, active")
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  if (uniqueQuoteIds.length === 0) {
    const { data: entitiesData } = await entitiesQuery;
    return {
      receiverEntities: mapReceiverEntities(entitiesData || []),
      orderByQuoteId: {},
    };
  }

  const [{ data: entitiesData }, { data: ordersData }] = await Promise.all([
    entitiesQuery,
    supabase
      .from("commercial_orders")
      .select(
        "id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at, customer_tax_profile_id"
      )
      .in("quote_id", uniqueQuoteIds),
  ]);

  const orderIds = ((ordersData || []) as CommercialOrderRow[]).map((order) => order.id);

  const [{ data: paymentsData }, { data: documentsData }] = orderIds.length
    ? await Promise.all([
        supabase
          .from("payments")
          .select("id, order_id, status, paid_at, created_at")
          .in("order_id", orderIds),
        supabase
          .from("commercial_documents")
          .select("id, order_id, payment_id, document_type, document_number, status, issued_at, created_at")
          .in("order_id", orderIds),
      ])
    : [{ data: [] }, { data: [] }];

  const orderByQuoteId: Record<string, CommercialOrderReceiverState> = {};
  const paymentsByOrderId = new Map<string, PaymentRow[]>();
  const documentsByOrderId = new Map<string, CommercialDocumentRow[]>();

  for (const payment of ((paymentsData || []) as PaymentRow[])) {
    const rows = paymentsByOrderId.get(payment.order_id) || [];
    rows.push(payment);
    paymentsByOrderId.set(payment.order_id, rows);
  }

  for (const document of ((documentsData || []) as CommercialDocumentRow[])) {
    const rows = documentsByOrderId.get(document.order_id) || [];
    rows.push(document);
    documentsByOrderId.set(document.order_id, rows);
  }

  for (const order of ((ordersData || []) as CommercialOrderRow[])) {
    const confirmedPayment = (paymentsByOrderId.get(order.id) || [])
      .filter((payment) => payment.status === "CONFIRMED")
      .sort((left, right) => {
        const leftTime = new Date(left.paid_at || left.created_at).getTime();
        const rightTime = new Date(right.paid_at || right.created_at).getTime();
        return rightTime - leftTime;
      })[0];
    const issuedDocument = (documentsByOrderId.get(order.id) || [])
      .filter((document) => document.status === "ISSUED")
      .sort((left, right) => {
        const leftTime = new Date(left.issued_at || left.created_at).getTime();
        const rightTime = new Date(right.issued_at || right.created_at).getTime();
        return rightTime - leftTime;
      })[0];

    orderByQuoteId[order.quote_id] = {
      id: order.id,
      selectedReceiverEntityId: order.selected_receiver_entity_id,
      paymentReceiverLockedAt: order.payment_receiver_locked_at,
      customerTaxProfileId: order.customer_tax_profile_id,
      confirmedPaymentId: confirmedPayment?.id || null,
      confirmedPaymentStatus: confirmedPayment?.status || null,
      issuedDocumentId: issuedDocument?.id || null,
      issuedDocumentType: issuedDocument?.document_type || null,
      issuedDocumentNumber: issuedDocument?.document_number || null,
      issuedDocumentStatus: issuedDocument?.status || null,
    };
  }

  return {
    receiverEntities: mapReceiverEntities(entitiesData || []),
    orderByQuoteId,
  };
}

function mapReceiverEntities(rows: unknown[]): CommercialReceiverEntityOption[] {
  return (rows as CommercialEntityRow[]).map((entity) => ({
    id: entity.id,
    legalName: entity.legal_name || entity.display_name || entity.id,
    displayName: entity.display_name || entity.legal_name || entity.id,
    role: entity.role,
    isVatRegistered: Boolean(entity.is_vat_registered),
    active: Boolean(entity.active),
  }));
}