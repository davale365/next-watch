"use client";

import { create } from "zustand";

export type WizardStep = "region" | "platforms" | "watches";

interface WizardState {
  step: WizardStep;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
}

const ORDER: WizardStep[] = ["region", "platforms", "watches"];

export const useWizardStore = create<WizardState>((set, get) => ({
  step: "region",
  goTo: (step) => set({ step }),
  next: () => {
    const idx = ORDER.indexOf(get().step);
    if (idx < ORDER.length - 1) set({ step: ORDER[idx + 1] });
  },
  back: () => {
    const idx = ORDER.indexOf(get().step);
    if (idx > 0) set({ step: ORDER[idx - 1] });
  },
}));
