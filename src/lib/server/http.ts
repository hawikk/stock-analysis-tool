import { Impit } from "impit";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const globalForHttp = globalThis as unknown as { __impit?: Impit };

// Yahoo and some other public endpoints reject non-browser TLS fingerprints (HTTP 429),
// so requests go through impit, which impersonates Chrome at the TLS/HTTP2 layer.
function client(): Impit {
  if (!globalForHttp.__impit) {
    globalForHttp.__impit = new Impit({ browser: "chrome", timeout: 12_000 });
  }
  return globalForHttp.__impit;
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
  if (opts.plain) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000), cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, url, text);
    return { text, headers: res.headers, status: res.status };
  }
  const res = await client().fetch(url, { headers });
  const text = await res.text();
  if (res.status >= 400 && !opts.acceptAnyStatus) throw new HttpError(res.status, url, text);
  return { text, headers: res.headers as unknown as Headers, status: res.status };
}

export async function httpJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const { text } = await httpText(url, opts);
  return JSON.parse(text) as T;
}
