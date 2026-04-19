import { getRuntimeAppConfig } from "@/lib/app-settings";
import IntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function IntakePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = await getRuntimeAppConfig();
  const searchParams = await props.searchParams;
  const initialCategory = firstValue(searchParams.category);
  const initialProduct =
    firstValue(searchParams.product) || firstValue(searchParams.productType);

  return (
    <IntakeForm
      liffId={config.liffId}
      uploadUrl={config.customerUploadUrl}
      uploadLabel={config.customerUploadLabel}
      initialCategory={initialCategory}
      initialProduct={initialProduct}
    />
  );
}
