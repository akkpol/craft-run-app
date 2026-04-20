import { getRuntimeAppConfig } from "@/lib/app-settings";
import IntakeForm from "./intake-form";

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function IntakePageContent(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = await getRuntimeAppConfig();
  const searchParams = await props.searchParams;
  const initialCategory = firstValue(searchParams.category);
  const initialProduct =
    firstValue(searchParams.product) || firstValue(searchParams.productType);
  const intakeMode =
    firstValue(searchParams.mode) === "fresh" ? "fresh" : "resume";

  return (
    <IntakeForm
      liffId={config.liffId}
      uploadUrl={config.customerUploadUrl}
      uploadLabel={config.customerUploadLabel}
      initialCategory={initialCategory}
      initialProduct={initialProduct}
      intakeMode={intakeMode}
    />
  );
}