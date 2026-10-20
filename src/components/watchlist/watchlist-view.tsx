"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Download, ListPlus, Pencil, Star, Trash2, Upload, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import type { Quote } from "@/lib/types";
import { useApi, useMounted, useNow, usePriceFlash } from "@/lib/hooks";
import { usePrefs, useTimeZone, type Watchlist } from "@/lib/store";
import { cn, currencySymbol, displaySymbol, fmtCompact, fmtDate, fmtPct, fmtPrice } from "@/lib/format";
import { SYMBOL_PATTERN } from "@/lib/symbols";
import { Panel } from "@/components/ui/panel";
import { Change } from "@/components/ui/change";
import { Sparkline } from "@/components/ui/sparkline";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { SymbolInput } from "@/components/ui/symbol-input";

export function WatchlistView() {
  const mounted = useMounted();
  const lists = usePrefs((s) => s.watchlists);
  const activeId = usePrefs((s) => s.activeWatchlist);
  const setActive = usePrefs((s) => s.setActiveWatchlist);
  const create = usePrefs((s) => s.createWatchlist);
  const rename = usePrefs((s) => s.renameWatchlist);
  const remove = usePrefs((s) => s.deleteWatchlist);
  const add = usePrefs((s) => s.addToWatchlist);
  const importLists = usePrefs((s) => s.importWatchlists);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = lists.find((l) => l.id === activeId) ?? lists[0];

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, watchlists: lists }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "watchlists.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseWatchlists(JSON.parse(await file.text()));
      importLists(parsed);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Invalid file");
    }
  };

  if (!mounted) {
    return (
      <Panel title="Watchlists">
        <SkeletonRows rows={8} />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Watchlists</h1>
          <p className="mt-0.5 text-sm text-muted">Saved in this browser. Export to move them to another device.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={exportJson}>
            <Download className="size-3.5" /> Export
          </button>
          <button className="btn-ghost text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {importError && <div className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">Import failed: {importError}</div>}

      <div className="flex flex-wrap items-center gap-1.5">
        {lists.map((l) =>
          renaming === l.id ? (
            <form
              key={l.id}
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name")?.toString().trim();
                if (name) rename(l.id, name);
                setRenaming(null);
              }}
            >
              <input name="name" defaultValue={l.name} autoFocus onBlur={() => setRenaming(null)} className="input w-40 py-1 text-xs" />
            </form>
          ) : (
            <button
              key={l.id}
              onClick={() => setActive(l.id)}
              onDoubleClick={() => setRenaming(l.id)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm transition", l.id === list?.id ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg")}
            >
              {l.name} <span className="ml-1 text-xs text-muted">{l.symbols.length}</span>
            </button>
          ),
        )}
        <button className="btn-ghost text-xs" onClick={() => create(`List ${lists.length + 1}`)}>
          <ListPlus className="size-3.5" /> New list
        </button>
      </div>

      {!list ? (
        <Panel>
          <EmptyState title="No watchlists yet" hint="Create one to start tracking symbols." icon={<Star className="size-6" />}>
            <button className="btn mt-2" onClick={() => create("My list")}>
              Create watchlist
            </button>
          </EmptyState>
        </Panel>
      ) : (
        <WatchlistTable
          list={list}
          actions={
            <div className="flex items-center gap-2">
              <SymbolInput onPick={(s) => add(s, list.id)} className="w-56" />
              <button className="btn-ghost p-1.5" title="Rename list" onClick={() => setRenaming(list.id)}>
                <Pencil className="size-3.5" />
              </button>
              <button
                className="btn-ghost p-1.5 hover:text-down"
                title="Delete list"
                onClick={() => {
                  if (confirm(`Delete "${list.name}"?`)) remove(list.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

function WatchlistTable({ list, actions }: { list: Watchlist; actions: ReactNode }) {
  const tz = useTimeZone();
  const move = usePrefs((s) => s.moveInWatchlist);
  const removeSymbol = usePrefs((s) => s.removeFromWatchlist);
  const url = list.symbols.length ? `/api/quotes?symbols=${encodeURIComponent(list.symbols.join(","))}&spark=1` : null;
  const { data, isLoading, error, refetch } = useApi<Quote[]>(url, { refetchInterval: 20_000 });
  const by = useMemo(() => new Map((data?.data ?? []).map((q) => [q.symbol, q])), [data]);

  const stats = useMemo(() => {
    const qs = list.symbols.map((s) => by.get(s)).filter((q): q is Quote => !!q && q.changePercent != null);
    if (!qs.length) return null;
    const avg = qs.reduce((a, q) => a + (q.changePercent ?? 0), 0) / qs.length;
    const up = qs.filter((q) => (q.changePercent ?? 0) > 0).length;
    const best = qs.reduce((a, b) => ((b.changePercent ?? 0) > (a.changePercent ?? 0) ? b : a));
    const worst = qs.reduce((a, b) => ((b.changePercent ?? 0) < (a.changePercent ?? 0) ? b : a));
    return { avg, up, total: qs.length, best, worst };
  }, [by, list.symbols]);

  return (
    <Panel
      title={list.name}
      subtitle={
        stats ? (
          <span>
            Equal-weight {fmtPct(stats.avg)} · {stats.up}/{stats.total} up · best {displaySymbol(stats.best.symbol)} {fmtPct(stats.best.changePercent, 1)} · worst {displaySymbol(stats.worst.symbol)}{" "}
            {fmtPct(stats.worst.changePercent, 1)}
          </span>
        ) : (
          `${list.symbols.length} symbols`
        )
      }
      meta={data?.meta}
      actions={actions}
    >
      {list.symbols.length === 0 && <EmptyState title="This list is empty" hint="Search for a ticker above, or press ⌘K anywhere and open a stock to add it." icon={<Star className="size-6" />} />}
      {isLoading && <SkeletonRows rows={Math.min(8, list.symbols.length)} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && list.symbols.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted">
                <th className="w-14 px-2 py-2" />
                <th className="px-2 py-2 text-left font-medium">Symbol</th>
                <th className="px-2 py-2 text-right font-medium">Last</th>
                <th className="px-2 py-2 text-right font-medium">Chg</th>
                <th className="px-2 py-2 text-right font-medium">Ext. hours</th>
                <th className="px-2 py-2 text-left font-medium">52-week range</th>
                <th className="px-2 py-2 text-right font-medium">Mkt cap</th>
                <th className="px-2 py-2 text-right font-medium">P/E</th>
                <th className="px-2 py-2 text-right font-medium">Earnings</th>
                <th className="px-2 py-2 text-right font-medium">Today</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.symbols.map((s, i) => (
                <WatchRow
                  key={s}
                  symbol={s}
                  q={by.get(s)}
                  tz={tz}
                  first={i === 0}
                  last={i === list.symbols.length - 1}
                  onUp={() => move(list.id, i, i - 1)}
                  onDown={() => move(list.id, i, i + 1)}
                  onRemove={() => removeSymbol(s, list.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function WatchRow({ symbol, q, tz, first, last, onUp, onDown, onRemove }: { symbol: string; q?: Quote; tz: string; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const flash = usePriceFlash(q?.price);
  const now = useNow(60_000);
  const ext = q?.marketState === "PRE" || q?.marketState === "PREPRE" ? { label: "Pre", price: q.preMarketPrice, pct: q.preMarketChangePercent } : q?.postMarketPrice ? { label: "Post", price: q.postMarketPrice, pct: q.postMarketChangePercent } : null;
  const lo = q?.fiftyTwoWeekLow;
  const hi = q?.fiftyTwoWeekHigh;
  const pos = lo != null && hi != null && q?.price != null && hi > lo ? ((q.price - lo) / (hi - lo)) * 100 : null;
  const earnings = q?.earningsTimestamp ? new Date(q.earningsTimestamp * 1000) : null;
  return (
    <tr className="table-row group">
      <td className="px-2">
        <div className="flex opacity-40 transition group-hover:opacity-100">
          <button disabled={first} onClick={onUp} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20" aria-label="Move up">
            <ArrowUp className="size-3.5" />
          </button>
          <button disabled={last} onClick={onDown} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20" aria-label="Move down">
            <ArrowDown className="size-3.5" />
          </button>
        </div>
      </td>
      <td className="px-2 py-2">
        <Link href={`/stock/${encodeURIComponent(symbol)}`} className="block hover:text-accent">
          <span className="font-semibold">{displaySymbol(symbol)}</span>
          <span className="block max-w-[14rem] truncate text-[11px] text-muted">{q?.name ?? "—"}</span>
        </Link>
      </td>
      <td className={cn("num px-2 text-right", flash === "up" && "animate-flash-up", flash === "down" && "animate-flash-down")}>
        {fmtPrice(q?.price)}
        {q?.currency && <span className="ml-1 text-[10px] text-muted">{currencySymbol(q.currency) || q.currency}</span>}
      </td>
      <td className="px-2 text-right">
        <Change value={q?.changePercent} pill />
      </td>
      <td className="px-2 text-right text-xs">
        {ext?.price ? (
          <span>
            <span className="text-[10px] text-muted">{ext.label} </span>
            <span className="num">{fmtPrice(ext.price)}</span> <Change value={ext.pct} digits={1} />
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-2">
        {pos != null ? (
          <div className="w-32">
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/50 via-slate-600/50 to-up/50">
              <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg bg-fg" style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} />
            </div>
            <div className="num mt-0.5 flex justify-between text-[10px] text-muted">
              <span>{fmtPrice(lo)}</span>
              <span>{fmtPrice(hi)}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </td>
      <td className="num px-2 text-right text-xs text-muted">{fmtCompact(q?.marketCap)}</td>
      <td className="num px-2 text-right text-xs">{q?.trailingPE ? q.trailingPE.toFixed(1) : "—"}</td>
      <td className="px-2 text-right text-xs">
        {earnings ? (
          <span className={cn(earnings.getTime() < now && "text-muted")} title={earnings.getTime() < now ? "Last report" : "Next report"}>
            {fmtDate(earnings.toISOString(), tz, { month: "short", day: "numeric" })}
            {earnings.getTime() < now && <span className="ml-1 text-[10px]">(last)</span>}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-2 py-1">
        <Sparkline data={q?.sparkline} baseline={q?.previousClose} width={90} height={26} className="ml-auto" />
      </td>
      <td className="px-2">
        <button onClick={onRemove} className="rounded p-1 text-muted opacity-0 transition hover:bg-white/10 hover:text-down group-hover:opacity-100" aria-label={`Remove ${symbol}`}>
          <X className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}

function parseWatchlists(raw: unknown): Watchlist[] {
  const arr = Array.isArray(raw) ? raw : (raw as { watchlists?: unknown })?.watchlists;
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Expected { watchlists: [...] }");
  return arr.map((w, i) => {
    const o = w as Partial<Watchlist>;
    if (typeof o.name !== "string" || !Array.isArray(o.symbols)) throw new Error(`List ${i + 1} is missing name or symbols`);
    return {
      id: typeof o.id === "string" ? o.id : `wl-import-${i}`,
      name: o.name.slice(0, 40),
      symbols: [...new Set(o.symbols.map((s) => String(s).toUpperCase()).filter((s) => SYMBOL_PATTERN.test(s)))].slice(0, 100),
    };
  });
}
