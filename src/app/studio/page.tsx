import { getRuntimeAppConfig } from "@/lib/app-settings";
import { fetchBackofficeSnapshot } from "@/lib/backoffice-snapshot";
import { buildStudioView } from "@/lib/studio-view";
import StudioSurface from "./studio-surface";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const [config, snapshot] = await Promise.all([
    getRuntimeAppConfig(),
    fetchBackofficeSnapshot(),
  ]);

  const view = buildStudioView(snapshot);

  return (
    <StudioSurface
      baseUrl={config.baseUrl}
      businessName={config.businessName}
      view={view}
    />
  );
}
