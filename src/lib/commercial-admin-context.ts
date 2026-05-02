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

  const orderByQuoteId: Record<string, CommercialOrderReceiverState> = {};

  for (const order of ((ordersData || []) as CommercialOrderRow[])) {
    orderByQuoteId[order.quote_id] = {
      id: order.id,
      selectedReceiverEntityId: order.selected_receiver_entity_id,
      paymentReceiverLockedAt: order.payment_receiver_locked_at,
      customerTaxProfileId: order.customer_tax_profile_id,
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