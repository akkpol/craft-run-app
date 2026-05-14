import { headers } from "next/headers";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { getLiffReadinessSummary } from "@/lib/public-flow-readiness";
import CustomerFlowCard from "@/components/customer-flow-card";
import IntakeForm from "./intake-form";

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isLocalHost(host: string | null) {
  if (!host) {
    return false;
  }

  const normalizedHost = host.toLowerCase();

  return (
    normalizedHost.startsWith("localhost:") ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost.startsWith("0.0.0.0:")
  );
}

export default async function IntakePageContent(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = await getRuntimeAppConfig();
  const searchParams = await props.searchParams;
  const headerStore = await headers();
  const requestHost =
    headerStore.get("x-forwarded-host") || headerStore.get("host");
  const initialCategory = firstValue(searchParams.category);
  const initialProduct =
    firstValue(searchParams.product) || firstValue(searchParams.productType);
  const intakeMode =
    firstValue(searchParams.mode) === "fresh" ? "fresh" : "resume";
  const disableLiffForLocalTest =
    isLocalHost(requestHost) ||
    (process.env.NODE_ENV !== "production" && firstValue(searchParams.devNoLiff) === "1");
  const initialScenarioId = firstValue(searchParams.scenario);
  // Show the test scenario picker on non-production Vercel deploys (preview +
  // local dev) automatically. For the production deployment, set
  // NEXT_PUBLIC_SHOW_TEST_SCENARIOS=true in Vercel env vars to opt in while
  // the app is still in its test-only phase; remove that var before real
  // customers are onboarded.
  const vEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const showTestPicker =
    vEnv !== "production" ||
    process.env.NEXT_PUBLIC_SHOW_TEST_SCENARIOS === "true";
  const readiness = getLiffReadinessSummary({ intakeMode });

  return (
    <div className="space-y-4">
      <CustomerFlowCard summary={readiness} />

      <IntakeForm
        businessName={config.businessName}
        liffId={disableLiffForLocalTest ? "" : config.liffId}
        uploadUrl={config.customerUploadUrl}
        uploadLabel={config.customerUploadLabel}
        initialCategory={initialCategory}
        initialProduct={initialProduct}
        intakeMode={intakeMode}
        initialScenarioId={showTestPicker ? initialScenarioId : undefined}
        showTestPicker={showTestPicker}
      />
    </div>
  );
}
