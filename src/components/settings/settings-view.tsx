"use client";

import Link from "next/link";
import { Bot, Check, Clock, Database, KeyRound, RotateCcw, Star } from "lucide-react";
import { useApi, useMounted } from "@/lib/hooks";
import { detectTimeZone, usePrefs, useTimeZone } from "@/lib/store";
import { DEFAULT_WATCHLISTS } from "@/lib/universe";
import { cn, fmtTime } from "@/lib/format";
import { tzAbbreviation } from "@/lib/time";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { TimezonePicker } from "@/components/shell/timezone-picker";

type Provider = { id: string; name: string; role: string; keyRequired: boolean; configured: boolean; optionalKey?: string; hasKey?: boolean };
type AiTarget = { provider: string; label: string; model: string; coolingUntil?: string; reason?: string };
type Status = {
  ai: { enabled: boolean; chain: AiTarget[]; last?: { target: string; ok: boolean; at: string; error?: string } };
  httpClient: { client: "impit" | "fetch" | "starting"; note?: string };
  providers: Provider[];
};

const KEY_LINKS: Record<string, string> = {
  FINNHUB_API_KEY: "https://finnhub.io/register",
  FRED_API_KEY: "https://fredaccount.stlouisfed.org/apikeys",
  COINGECKO_API_KEY: "https://www.coingecko.com/en/developers/dashboard",
};

export function SettingsView() {
  const mounted = useMounted();
  const tz = useTimeZone();
  const pref = usePrefs((s) => s.timeZone);
  const lists = usePrefs((s) => s.watchlists);
  const importLists = usePrefs((s) => s.importWatchlists);
  const setTz = usePrefs((s) => s.setTimeZone);
  const { data, isLoading, error, refetch } = useApi<Status>("/api/status");
  const st = data?.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted">Preferences are stored locally in this browser; API keys live in server environment variables.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Time zone" icon={<Clock className="size-4" />} subtitle="Used for calendars, market sessions and timestamps">
          <div className="space-y-3 p-4 text-sm">
            {mounted ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <TimezonePicker />
                  <span className="text-muted">
                    {pref === "auto" ? "Auto-detected from your browser" : "Manual override"} · now <span className="num text-fg">{fmtTime(new Date(), tz)}</span>{" "}
                    {tzAbbreviation(tz)}
                  </span>
                </div>
                {pref !== "auto" && (
                  <button className="btn-ghost text-xs" onClick={() => setTz("auto")}>
                    <RotateCcw className="size-3.5" /> Use browser time zone ({detectTimeZone()})
                  </button>
                )}
              </>
            ) : (
              <SkeletonRows rows={2} />
            )}
          </div>
        </Panel>

        <Panel title="AI analysis" icon={<Bot className="size-4" />} subtitle="Stock analysis and the market brief">
          <div className="space-y-3 p-4 text-sm">
            {isLoading && <SkeletonRows rows={2} />}
            {st &&
              (st.ai.enabled ? (
                <>
                  <p className="text-muted">
                    Models are tried in order; one that is rate-limited or retired is skipped for a while, and if all fail the built-in quant engine answers.
                  </p>
                  <ol className="space-y-1">
                    {st.ai.chain.map((t, i) => (
                      <li key={`${t.provider}/${t.model}`} className="flex items-center gap-2 text-xs" title={t.reason}>
                        <span className="num w-4 text-right text-muted">{i + 1}</span>
                        <span className={cn("size-1.5 shrink-0 rounded-full", t.coolingUntil ? "bg-amber-400" : "bg-up")} />
                        <span className="text-muted">{t.label}</span>
                        <span className="num truncate text-fg">{t.model}</span>
                        {t.coolingUntil && mounted && <span className="ml-auto shrink-0 text-amber-300">paused until {fmtTime(new Date(t.coolingUntil), tz)}</span>}
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-xs">
                      <span className="num w-4 text-right text-muted">{st.ai.chain.length + 1}</span>
                      <span className="size-1.5 shrink-0 rounded-full bg-slate-500" />
                      <span className="text-muted">Built-in</span>
                      <span className="text-fg">quant engine</span>
                    </li>
                  </ol>
                  {st.ai.last && mounted && (
                    <p className="flex items-center gap-2 text-xs text-muted">
                      {st.ai.last.ok ? <Check className="size-3.5 text-up" /> : <span className="size-1.5 rounded-full bg-down" />}
                      {st.ai.last.ok ? "Last answer from" : "Last failed attempt:"} <span className="num text-fg">{st.ai.last.target}</span> at{" "}
                      {fmtTime(new Date(st.ai.last.at), tz)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    No AI key is configured, so analyses use the built-in <span className="font-medium">quant engine</span> (rules-based scoring of valuation, growth, quality,
                    momentum, balance sheet and sentiment).
                  </p>
                  <p className="text-muted">
                    For written theses, set <code className="text-fg">OPENROUTER_API_KEY</code> (free models, key at{" "}
                    <a className="text-accent hover:underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                      openrouter.ai/keys
                    </a>
                    ) or <code className="text-fg">GEMINI_API_KEY</code>, <code className="text-fg">GROQ_API_KEY</code> or <code className="text-fg">OPENAI_API_KEY</code>, then
                    redeploy.
                  </p>
                </>
              ))}
          </div>
        </Panel>
      </div>

      <Panel title="Data sources" icon={<Database className="size-4" />} subtitle="Everything works without keys; optional keys add redundancy or higher limits" meta={data?.meta}>
        {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
        {isLoading && <SkeletonRows rows={6} />}
        {st && (
          <ul className="divide-y divide-line/60">
            {st.providers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className={cn("size-2 rounded-full", p.configured ? "bg-up" : "bg-slate-600")} />
                <span className="min-w-40 font-medium">{p.name}</span>
                <span className="flex-1 text-muted">{p.role}</span>
                {p.optionalKey ? (
                  <span className="flex items-center gap-2 text-xs">
                    <KeyRound className={cn("size-3.5", p.hasKey ? "text-up" : "text-muted")} />
                    <code>{p.optionalKey}</code>
                    {p.hasKey ? (
                      <span className="text-up">set</span>
                    ) : (
                      <a className="text-accent hover:underline" href={KEY_LINKS[p.optionalKey]} target="_blank" rel="noreferrer">
                        {p.keyRequired ? "get free key" : "optional"}
                      </a>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted">no key needed</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {st && (
          <p className="border-t border-line/60 px-4 py-2.5 text-xs text-muted">
            Yahoo transport:{" "}
            {st.httpClient.client === "fetch" ? (
              <span className="text-amber-300" title={st.httpClient.note}>
                plain fetch (Chrome impersonation unavailable{st.httpClient.note ? `: ${st.httpClient.note.slice(0, 80)}` : ""})
              </span>
            ) : st.httpClient.client === "impit" ? (
              <span className="text-fg">Chrome TLS impersonation (impit)</span>
            ) : (
              "not used yet"
            )}
          </p>
        )}
      </Panel>

      <Panel title="Watchlists" icon={<Star className="size-4" />}>
        <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <span className="text-muted">{mounted ? `${lists.length} lists · ${lists.reduce((a, l) => a + l.symbols.length, 0)} symbols` : "—"}</span>
          <Link href="/watchlist" className="btn-ghost text-xs">
            Manage, import & export
          </Link>
          <button
            className="btn-ghost text-xs hover:text-down"
            onClick={() => {
              if (confirm("Replace all watchlists with the defaults?")) importLists(DEFAULT_WATCHLISTS);
            }}
          >
            <RotateCcw className="size-3.5" /> Reset to defaults
          </button>
        </div>
      </Panel>

      <p className="text-xs text-muted">Market data may be delayed and is provided for information only. Nothing here is investment advice.</p>
    </div>
  );
}
