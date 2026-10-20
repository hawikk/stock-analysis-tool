import type { Impit } from "impit";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type ClientState = { impit: Impit | null; error?: string };

const globalForHttp = globalThis as unknown as { __httpClient?: Promise<ClientState> };

// Yahoo and some other public endpoints reject non-browser TLS fingerprints (HTTP 429), so requests
// go through impit, which impersonates Chrome at the TLS/HTTP2 layer. impit is a native addon, so it
// is imported lazily: if the binary cannot load on a host (or HTTP_CLIENT=fetch), everything keeps
// working on plain fetch instead of failing at module load.
function client(): Promise<ClientState> {
  globalForHttp.__httpClient ??= (async (): Promise<ClientState> => {
    if (process.env.HTTP_CLIENT === "fetch") return { impit: null, error: "disabled by HTTP_CLIENT=fetch" };
    try {
      const { Impit } = await import("impit");
      return { impit: new Impit({ browser: "chrome", timeout: 12_000 }) };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`[http] impit unavailable, using plain fetch: ${error}`);
      return { impit: null, error };
    }
  })();
  return globalForHttp.__httpClient;
}

let resolved: ClientState | undefined;

export function httpClientStatus(): { client: "impit" | "fetch" | "starting"; note?: string } {
  if (!resolved) return { client: "starting" };
  return resolved.impit ? { client: "impit" } : { client: "fetch", note: resolved.error };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    body?: string,
  ) {
    super(`HTTP ${status} for ${url.split("?")[0]}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }
}

export type HttpOptions = {
  headers?: Record<string, string>;
  /** Use plain fetch instead of the browser-impersonating client. */
  plain?: boolean;
  timeoutMs?: number;
  acceptAnyStatus?: boolean;
};

export async function httpText(url: string, opts: HttpOptions = {}): Promise<{ text: string; headers: Headers; status: number }> {
  const headers = {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    ...opts.headers,
  };
  const state = opts.plain ? null : (resolved = await client());
  if (!state?.impit) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000), cache: "no-store" });
    const text = await res.text();
    if (!res.ok && !opts.acceptAnyStatus) throw new HttpError(res.status, url, text);
    return { text, headers: res.headers, status: res.status };
  }
  const res = await state.impit.fetch(url, { headers });
  const text = await res.text();
  if (res.status >= 400 && !opts.acceptAnyStatus) throw new HttpError(res.status, url, text);
  return { text, headers: res.headers as unknown as Headers, status: res.status };
}

export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const { text } = await httpText(url, opts);
  return JSON.parse(text) as T;
}
