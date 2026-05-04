const VOWELS = ["a", "e", "i", "o", "u"] as const;
const VOWEL_SET = new Set<string>(VOWELS);

function longestToken(query: string): { token: string; index: number } | null {
  const tokens = query.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  let best = tokens[0];
  let bestIdx = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].length > best.length) {
      best = tokens[i];
      bestIdx = i;
    }
  }
  return { token: best, index: bestIdx };
}

function vowelSubstitutions(token: string): string[] {
  const lower = token.toLowerCase();
  const positions: number[] = [];
  for (let i = 0; i < lower.length; i++) {
    if (VOWEL_SET.has(lower[i])) positions.push(i);
  }
  const out: string[] = [];
  const seen = new Set<string>([lower]);
  for (let altIdx = 0; altIdx < VOWELS.length - 1; altIdx++) {
    for (const p of positions) {
      const others = VOWELS.filter((v) => v !== lower[p]);
      const ch = others[altIdx];
      if (!ch) continue;
      const v = lower.slice(0, p) + ch + lower.slice(p + 1);
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

function transpositions(token: string): string[] {
  const lower = token.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>([lower]);
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) continue;
    const swapped =
      lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2);
    if (!seen.has(swapped)) {
      seen.add(swapped);
      out.push(swapped);
    }
  }
  return out;
}

function doubleLetterDeletions(token: string): string[] {
  const lower = token.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>([lower]);
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) {
      const trimmed = lower.slice(0, i) + lower.slice(i + 1);
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  return out;
}

export function generateVariants(query: string, max = 8): string[] {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];
  const longest = longestToken(trimmed);
  if (!longest || longest.token.length < 4) return [];

  const tokens = trimmed.split(/\s+/);
  const ordered: string[] = [
    ...vowelSubstitutions(longest.token),
    ...doubleLetterDeletions(longest.token),
    ...transpositions(longest.token),
  ];

  const variants: string[] = [];
  const seen = new Set<string>([trimmed.toLowerCase()]);
  for (const vt of ordered) {
    const next = [...tokens];
    next[longest.index] = vt;
    const candidate = next.join(" ");
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(candidate);
    if (variants.length >= max) break;
  }
  return variants;
}
