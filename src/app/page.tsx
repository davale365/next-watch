import { Wizard } from "@/components/wizard/Wizard";
import { getCurrentUser } from "@/lib/user/session";
import { listAddedTitlesForUser } from "@/lib/titles/list";
import { DEFAULT_REGION, isRegionActive } from "@/lib/regions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const region =
    user && isRegionActive(user.region) ? user.region : DEFAULT_REGION;
  const platforms = user?.selectedPlatforms ?? [];
  const added = user ? await listAddedTitlesForUser(user.id) : [];

  return (
    <Wizard
      initialRegion={region}
      initialPlatforms={platforms}
      initialAdded={added}
    />
  );
}
