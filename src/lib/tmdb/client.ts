import "server-only";

const TMDB_BASE = "https://api.themoviedb.org/3";

export { TMDB_IMAGE_BASE, posterUrl } from "./images";

export class TmdbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

interface CachedResponse<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CachedResponse<unknown>>();

const DEFAULT_TTL_MS = 1000 * 60 * 5;

function cacheKey(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, v);
  }
  search.sort();
  return `${path}?${search.toString()}`;
}

export interface TmdbFetchOptions {
  ttlMs?: number;
  signal?: AbortSignal;
}

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  options: TmdbFetchOptions = {}
): Promise<T> {
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) {
    throw new TmdbError(
      "TMDB_API_READ_TOKEN is not set — get a v4 read token at https://www.themoviedb.org/settings/api",
      0,
      path
    );
  }

  const stringParams: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) {
    stringParams[k] = v === undefined ? undefined : String(v);
  }

  const key = cacheKey(path, stringParams);
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;

  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(stringParams)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    signal: options.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TmdbError(
      `TMDB ${res.status} on ${path}: ${body.slice(0, 200)}`,
      res.status,
      path
    );
  }

  const data = (await res.json()) as T;
  memoryCache.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
}

export function __resetTmdbCacheForTests() {
  memoryCache.clear();
}
