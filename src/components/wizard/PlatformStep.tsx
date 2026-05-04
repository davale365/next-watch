"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { providersForRegion } from "@/lib/providers";
import { updatePlatformsAction } from "@/lib/actions/user";
import { useWizardStore } from "@/state/wizard";
import type { RegionCode } from "@/lib/regions";

export function PlatformStep({
  region,
  initialSelected,
}: {
  region: RegionCode;
  initialSelected: number[];
}) {
  const next = useWizardStore((s) => s.next);
  const back = useWizardStore((s) => s.back);
  const providers = useMemo(() => providersForRegion(region), [region]);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialSelected)
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePlatformsAction({ platformIds: Array.from(selected) });
        next();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save platforms");
      }
    });
  }

  const canContinue = selected.size > 0 && !pending;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Which streaming services do you have?
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick everything you can stream from. We&apos;ll only recommend titles
          available on these platforms.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {providers.map((p) => {
          const isSelected = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(p.id)}
                className={[
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition",
                  isSelected
                    ? "border-foreground bg-foreground/5"
                    : "border-border hover:border-foreground/40",
                ].join(" ")}
              >
                <span className="font-medium">{p.name}</span>
                {isSelected && <span aria-hidden>✓</span>}
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

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => back()} disabled={pending}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </section>
  );
}
