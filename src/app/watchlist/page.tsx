import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user/session";
import { listWatchlistForUser } from "@/lib/watchlist/list";
import { posterUrl } from "@/lib/tmdb/images";

export const dynamic = "force-dynamic";

const ADDED_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const entries = await listWatchlistForUser(user.id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your watchlist
        </h1>
        {entries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {`${entries.length} title${entries.length === 1 ? "" : "s"} saved.`}
          </p>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Your watchlist is empty. Add titles from your picks.
          </p>
          <Link
            href="/picks"
            className="inline-flex h-8 items-center rounded-lg border border-foreground bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
          >
            Go to picks
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {entries.map(({ title, addedAt }) => {
            const poster = posterUrl(title.posterPath, "w342");
            return (
              <li
                key={title.id}
                className="flex flex-col overflow-hidden rounded-lg border bg-card"
              >
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt=""
                    className="aspect-[2/3] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[2/3] w-full bg-muted" />
                )}
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="text-sm font-semibold leading-tight">
                    {title.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {title.year ?? "—"} ·{" "}
                    {title.mediaType === "movie" ? "Movie" : "TV"}
                  </p>
                  <p className="mt-auto pt-2 text-[11px] text-muted-foreground">
                    Added {ADDED_DATE_FORMAT.format(addedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href="/picks" className="underline-offset-2 hover:underline">
          Back to picks
        </Link>
        <Link href="/" className="underline-offset-2 hover:underline">
          Edit your watches and platforms
        </Link>
      </footer>
    </main>
  );
}
