import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PicksPlaceholderPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Next Watch
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Recommendations are coming next.
      </h1>
      <p className="text-sm text-muted-foreground">
        Phase 1 captures your region, platforms, and recent watches with
        reactions. The recommendation engine and the three-card slate land in
        Phase 2.
      </p>
      <Link
        href="/"
        className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        Back to onboarding
      </Link>
    </main>
  );
}
