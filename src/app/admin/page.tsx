import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  fetchAdminOverviewPage,
  normalizeOverviewFilterKey,
} from "@/lib/admin-overview";
import { buildBackofficeAutomationSnapshot } from "@/lib/backoffice-automation";
import { fetchBackofficeSnapshot } from "@/lib/backoffice-snapshot";

import AdminDashboardClient from "./admin-dashboard-client";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const requestedFilter = firstValue(searchParams.filter);
  const requestedPage = Number(firstValue(searchParams.page) || "1");
  const filter = normalizeOverviewFilterKey(requestedFilter) || "all";

  const [config, snapshot] = await Promise.all([
    getRuntimeAppConfig(),
    fetchBackofficeSnapshot(),
  ]);
  const automation = buildBackofficeAutomationSnapshot(snapshot);
  const overview = await fetchAdminOverviewPage({
    baseUrl: config.baseUrl,
    filter,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });

  return (
    <AdminDashboardClient
      baseUrl={config.baseUrl}
      automation={automation}
      overview={overview}
    />
  );
}