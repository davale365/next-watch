"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ACTIVE_REGION_COPY, REGIONS, type RegionCode } from "@/lib/regions";
import { updateRegionAction } from "@/lib/actions/user";
import { useWizardStore } from "@/state/wizard";

export function RegionStep({ initialRegion }: { initialRegion: RegionCode }) {
  const next = useWizardStore((s) => s.next);
  const [selected, setSelected] = useState<RegionCode>(initialRegion);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      try {
        await updateRegionAction({ region: selected });
        next();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save region");
      }
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Where are you watching from?
        </h2>
        <p className="text-sm text-muted-foreground">{ACTIVE_REGION_COPY}</p>
      </header>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REGIONS.map((r) => {
          const active = r.status === "active";
          const isSelected = selected === r.code;
          return (
            <li key={r.code}>
              <button
                type="button"
                disabled={!active}
                aria-pressed={isSelected}
                onClick={() => active && setSelected(r.code)}
                className={[
                  "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition",
                  active
                    ? isSelected
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/40"
                    : "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground",
                ].join(" ")}
              >
                <span className="font-medium">{r.label}</span>
                {!active && (
                  <span className="text-xs uppercase tracking-wide">
                    Coming soon
                  </span>
                )}
                {active && isSelected && (
                  <span className="text-xs uppercase tracking-wide">
                    Selected
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </section>
  );
}
