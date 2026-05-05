"use client";

import { useEffect } from "react";
import { useWizardStore } from "@/state/wizard";
import { StepHeader } from "@/components/wizard/StepHeader";
import { RegionStep } from "@/components/wizard/RegionStep";
import { PlatformStep } from "@/components/wizard/PlatformStep";
import { WatchesStep } from "@/components/wizard/WatchesStep";
import type { RegionCode } from "@/lib/regions";
import type { AddedTitle } from "@/lib/actions/titles";

interface Props {
  initialRegion: RegionCode;
  initialPlatforms: number[];
  initialAdded: AddedTitle[];
}

export function Wizard({
  initialRegion,
  initialPlatforms,
  initialAdded,
}: Props) {
  const step = useWizardStore((s) => s.step);
  const goTo = useWizardStore((s) => s.goTo);

  useEffect(() => {
    if (initialAdded.length > 0) goTo("watches");
    else if (initialPlatforms.length > 0) goTo("platforms");
  }, [initialAdded.length, initialPlatforms.length, goTo]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <StepHeader current={step} />
      </header>

      {step === "region" && <RegionStep initialRegion={initialRegion} />}
      {step === "platforms" && (
        <PlatformStep
          region={initialRegion}
          initialSelected={initialPlatforms}
        />
      )}
      {step === "watches" && <WatchesStep initial={initialAdded} />}
    </div>
  );
}
