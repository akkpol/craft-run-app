import { NextResponse } from "next/server";
import { getProductCatalog } from "@/lib/product-catalog-store";

export async function GET() {
  const { items, source } = await getProductCatalog({ activeOnly: true });

  return NextResponse.json({
    products: items,
    source,
  });
}