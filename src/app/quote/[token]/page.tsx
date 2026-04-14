import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PRODUCT_TYPES } from "@/lib/types";
import QuoteApproveButton from "./approve-button";

export default async function QuotePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*), leads(*, customers(*))")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const items = quote.quote_items || [];
  const productLabel = PRODUCT_TYPES.find((p) => p.value === lead?.product_type)?.label || lead?.product_type || "ไม่ระบุ";
  const isApproved = quote.status === "approved";
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-t-2xl px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">📄 ใบเสนอราคา</h1>
              <p className="text-xs text-gray-400 mt-1">FOGUS Print &amp; Sign</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${isApproved ? "bg-green-100 text-green-700" : isExpired ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
              {isApproved ? "อนุมัติแล้ว" : isExpired ? "หมดอายุ" : "รอการอนุมัติ"}
            </div>
          </div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">ข้อมูลลูกค้า</h2>
          <p className="text-sm text-gray-900">{customer?.display_name || "ไม่ระบุ"}</p>
          {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">รายละเอียดงาน</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">ประเภท:</span> <span className="font-medium">{productLabel}</span></p>
            {lead && <p><span className="text-gray-500">ขนาด:</span> {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.</p>}
            {lead?.qty && <p><span className="text-gray-500">จำนวน:</span> {lead.qty} ชิ้น</p>}
            {lead?.due_date && <p><span className="text-gray-500">กำหนดส่ง:</span> {new Date(lead.due_date).toLocaleDateString("th-TH")}</p>}
            {lead?.note_from_form && <p><span className="text-gray-500">หมายเหตุ:</span> {lead.note_from_form}</p>}
          </div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-3">รายการ</h2>
          {items.map((item: { id: string; label: string; line_total: number }) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.label}</span>
              <span className="font-medium">฿{Number(item.line_total).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-gray-500">ราคาก่อน VAT</span><span>฿{Number(quote.subtotal).toLocaleString()}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">VAT 7%</span><span>฿{Number(quote.vat).toLocaleString()}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100"><span>รวมทั้งสิ้น</span><span className="text-[#1a1a2e]">฿{Number(quote.total).toLocaleString()}</span></div>
        </div>

        {quote.valid_until && (
          <div className="bg-white px-6 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 text-center">ใบเสนอราคาใช้ได้ถึง {new Date(quote.valid_until).toLocaleDateString("th-TH")}</p>
          </div>
        )}

        <div className="bg-white rounded-b-2xl px-6 py-5">
          {isApproved ? (
            <div className="text-center text-green-600 font-medium">✅ อนุมัติแล้ว — ทีมงานกำลังดำเนินการ</div>
          ) : isExpired ? (
            <div className="text-center text-red-500 text-sm">ใบเสนอราคานี้หมดอายุแล้ว</div>
          ) : (
            <QuoteApproveButton quoteId={quote.id} />
          )}
        </div>
      </div>
    </div>
  );
}
