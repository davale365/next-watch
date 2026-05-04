import type { WizardStep } from "@/state/wizard";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "region", label: "Region" },
  { key: "platforms", label: "Platforms" },
  { key: "watches", label: "Recent watches" },
];

export function StepHeader({ current }: { current: WizardStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-sm text-muted-foreground">
      {STEPS.map((s, idx) => {
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : isDone
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-muted-foreground/30",
              ].join(" ")}
            >
              {idx + 1}
            </span>
            <span
              className={isActive ? "font-medium text-foreground" : undefined}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <span aria-hidden className="mx-1 text-muted-foreground/40">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
