import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  fetchBackofficeSnapshot,
  getBackofficeKpis,
} from "@/lib/backoffice-snapshot";
import { buildProductionLinkUrl } from "@/lib/production-links";
import { getShareableProductionToken, isExpired } from "@/lib/production-media";

import AdminDashboardClient from "./admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const config = await getRuntimeAppConfig();
  const snapshot = await fetchBackofficeSnapshot();
  const kpis = getBackofficeKpis(snapshot);
  const baseUrl = config.baseUrl;

  const snapshotWithLinks = {
    ...snapshot,
    jobs: snapshot.jobs.map((job) => {
      const activeLink = (job.job_production_links || []).find(
        (link) => link.status === "active" && !isExpired(link.expires_at)
      );

      return {
        ...job,
        production_link_url: activeLink
          ? buildProductionLinkUrl(
              baseUrl,
              getShareableProductionToken(activeLink.id)
            )
          : null,
      };
    }),
    productionReviewQueue: snapshot.productionReviewQueue.map((event) => ({
      ...event,
      production_link_url:
        event.job_production_links?.status === "active" &&
        !isExpired(event.job_production_links.expires_at)
          ? buildProductionLinkUrl(
              baseUrl,
              getShareableProductionToken(event.job_production_links.id)
            )
          : null,
    })),
  };

  return (
    <AdminDashboardClient
      baseUrl={baseUrl}
      kpis={kpis}
      snapshot={snapshotWithLinks}
    />
  );
}