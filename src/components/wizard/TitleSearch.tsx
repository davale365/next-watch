"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { searchTitles, type TitleSearchHit } from "@/lib/actions/search";
import { posterUrl } from "@/lib/tmdb/images";

interface Props {
  excludeIds: Set<string>;
  onSelect: (hit: TitleSearchHit) => void;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function TitleSearch({ excludeIds, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 250);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = debounced.length >= 2;
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchTitles({ query: debounced }),
    enabled,
    staleTime: 60_000,
  });

  const visible = (data ?? []).filter((h) => !excludeIds.has(h.id));

  function handleSelect(hit: TitleSearchHit) {
    onSelect(hit);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        ref={inputRef}
        autoFocus
        placeholder="Search a movie or show you've watched recently…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {enabled && (
        <div className="rounded-md border bg-card">
          {isFetching && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </p>
          )}
          {isError && (
            <p className="px-3 py-2 text-sm text-destructive">
              Search failed. Try again.
            </p>
          )}
          {!isFetching && !isError && visible.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matches.
            </p>
          )}
          <ul role="listbox" className="max-h-72 divide-y overflow-auto">
            {visible.map((hit) => {
              const poster = posterUrl(hit.posterPath, "w185");
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(hit)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted"
                  >
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        width={36}
                        height={54}
                        className="h-[54px] w-9 rounded object-cover"
                      />
                    ) : (
                      <div className="h-[54px] w-9 rounded bg-muted" />
                    )}
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium leading-tight">
                        {hit.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {hit.year ?? "—"} ·{" "}
                        {hit.mediaType === "movie" ? "Movie" : "TV"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
