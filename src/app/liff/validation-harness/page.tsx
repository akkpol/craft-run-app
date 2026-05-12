import { getRuntimeAppConfig } from "@/lib/app-settings";

import ValidationHarnessClient from "./validation-harness-client";

export const dynamic = "force-dynamic";

export default async function LiffValidationHarnessPage() {
  const config = await getRuntimeAppConfig();

  return (
    <ValidationHarnessClient
      businessName={config.businessName}
      liffId={config.liffId}
    />
  );
}