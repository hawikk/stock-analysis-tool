import type { DataSource, Meta } from "@/lib/types";
import { cached } from "./cache";
import { SYMBOL_PATTERN } from "@/lib/symbols";

type Loaded<T> = { data: T; source: DataSource | DataSource[]; note?: string };

/**
 * Serve `loader` through the shared cache; on failure fall back to `fallback` (mock data) so the UI
 * always renders, flagged via `meta.source = "mock"`.
 */
export async function serve<T>(opts: {
  key: string;
  ttl: number;
  load: () => Promise<Loaded<T>>;
  fallback?: () => T;
  maxAge?: number;
}): Promise<Response> {
  const maxAge = opts.maxAge ?? Math.min(opts.ttl, 60);
  try {
    const { value, stale } = await cached(opts.key, opts.ttl, opts.load);
    const meta: Meta = { source: value.source, asOf: new Date().toISOString(), stale, note: value.note };
    return Response.json({ data: value.data, meta }, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}` } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${opts.key}]`, message);
    if (opts.fallback) {
      const meta: Meta = { source: "mock", asOf: new Date().toISOString(), note: `Live data unavailable (${message}). Showing demo data.` };
      return Response.json({ data: opts.fallback(), meta }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export const SYMBOL_RE = SYMBOL_PATTERN;

export function parseSymbols(raw: string | null, max = 200): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s)))].slice(0, max);
}
