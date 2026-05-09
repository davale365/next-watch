type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [k: string]: Json };

export type LogFields = Record<string, Json | undefined>;

export function logEvent(event: string, fields: LogFields): void {
  try {
    const cleaned: LogFields = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) cleaned[k] = v;
    }
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...cleaned,
    });
    console.log(line);
  } catch {
    // logging must never crash a request
  }
}

export class Phaser {
  private start = Date.now();
  private last = Date.now();
  private readonly entries: Record<string, number> = {};

  mark(name: string): void {
    const now = Date.now();
    this.entries[name] = now - this.last;
    this.last = now;
  }

  total(): number {
    return Date.now() - this.start;
  }

  toFields(): Record<string, number> {
    return { ...this.entries, total_ms: this.total() };
  }
}
