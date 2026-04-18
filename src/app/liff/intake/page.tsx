import { getRuntimeAppConfig } from "@/lib/app-settings";
import IntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const config = await getRuntimeAppConfig();

  return (
    <IntakeForm
      liffId={config.liffId}
      uploadUrl={config.customerUploadUrl}
      uploadLabel={config.customerUploadLabel}
    />
  );
}
