import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  APP_LOCALES,
  LOCALE_DISPLAY_NAMES,
  resolveSurfaceLocale,
  type AppLocale,
} from "@/lib/locale";
import {
  getProductionPageCopy,
  type ProductionPageCopy,
} from "@/lib/production-copy";
import { resolveProductionToken } from "@/lib/production-media";
import {
  PRODUCTION_EVENT_TYPES,
  getProductionEventTypeLabel,
} from "@/lib/production-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobStatusLabel, getProductTypeLabel, isJobStatus } from "@/lib/types";
import ProductionUploadForm from "./production-upload-form";

export const dynamic = "force-dynamic";

function InvalidLinkState({
  copy,
  locale,
}: {
  copy: ProductionPageCopy;
  locale: AppLocale;
}) {
  return (
    <div lang={locale} className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{copy.invalidTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.invalidDescription}</p>
      </div>
    </div>
  );
}

export default async function ProductionPage(props: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] | undefined }>;
}) {
  const { token } = await props.params;
  const searchParams: { lang?: string | string[] | undefined } = props.searchParams
    ? await props.searchParams
    : {};
  const locale = resolveSurfaceLocale({
    surface: "production",
    requested: searchParams.lang,
  });
  const copy = getProductionPageCopy(locale);
  const [runtimeConfig, resolved] = await Promise.all([
    getRuntimeAppConfig(),
    resolveProductionToken(createAdminClient(), token),
  ]);

  if (!resolved) {
    return <InvalidLinkState copy={copy} locale={locale} />;
  }

  const lead = Array.isArray(resolved.job?.quotes?.leads)
    ? resolved.job?.quotes?.leads[0]
    : resolved.job?.quotes?.leads;
  const customer = Array.isArray(lead?.customers) ? lead?.customers[0] : lead?.customers;
  const productLabel =
    getProductTypeLabel(lead?.product_type, locale) ?? copy.unknownProductLabel;
  const jobStatusLabel =
    resolved.job?.status && isJobStatus(resolved.job.status)
      ? getJobStatusLabel(resolved.job.status, locale)
      : resolved.job?.status || getJobStatusLabel("IN_PRODUCTION", locale);
  const eventOptions = PRODUCTION_EVENT_TYPES.map((eventType) => ({
    value: eventType,
    label: getProductionEventTypeLabel(eventType, locale),
  }));

  return (
    <div
      lang={locale}
      className="min-h-screen bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_35%,#ffffff_100%)] px-4 py-6 text-slate-900"
      style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="overflow-hidden rounded-[30px] border border-slate-900/10 bg-[#0f172a] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="px-6 py-6">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-300">
              {copy.headerEyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              {customer?.display_name || copy.headerFallbackTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-300">{copy.headerDescription}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>{copy.languageLabel}</span>
              {APP_LOCALES.map((localeCode) => {
                const isActive = localeCode === locale;

                return (
                  <a
                    key={localeCode}
                    href={`?lang=${localeCode}`}
                    className={
                      isActive
                        ? "rounded-full bg-white/15 px-3 py-1 font-medium text-white"
                        : "rounded-full border border-white/20 px-3 py-1 text-slate-200"
                    }
                  >
                    {LOCALE_DISPLAY_NAMES[localeCode]}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {copy.jobLabel}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{productLabel}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {jobStatusLabel}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <dt>{copy.customerNameLabel}</dt>
              <dd className="font-medium text-slate-900">
                {customer?.display_name || copy.unknownValueLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{copy.uploadStatusLabel}</dt>
              <dd className="font-medium text-slate-900">
                {runtimeConfig.productionUploadEnabled
                  ? copy.uploadEnabledLabel
                  : copy.uploadDisabledLabel}
              </dd>
            </div>
          </dl>
        </div>

        {!runtimeConfig.productionUploadEnabled ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
            {copy.uploadPausedMessage}
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">{copy.formTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{copy.formDescription}</p>
            <div className="mt-5">
              <ProductionUploadForm
                token={token}
                copy={copy.form}
                eventOptions={eventOptions}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
