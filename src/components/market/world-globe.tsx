"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Globe2, X } from "lucide-react";
import type { PerfWindow, WorldIndexRow } from "@/lib/types";
import { useApi, useElementSize, useMounted, useNow } from "@/lib/hooks";
import { exchangeStatus } from "@/lib/market-hours";
import { EXCHANGES } from "@/lib/universe";
import { changeColor, fmtPct, fmtPrice } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState } from "@/components/ui/states";
import { Change } from "@/components/ui/change";
import { Sparkline } from "@/components/ui/sparkline";

const GlobeInner = dynamic(() => import("./globe-inner"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

function GlobeSkeleton() {
  return (
    <div className="grid h-full place-items-center">
      <div className="size-56 animate-pulse rounded-full bg-gradient-to-br from-sky-500/10 to-violet-500/10 ring-1 ring-sky-400/20" />
    </div>
  );
}

const WINDOWS: PerfWindow[] = ["1D", "1W", "1M", "YTD", "1Y"];
const SCALE: Record<PerfWindow, number> = { "1D": 2, "1W": 4, "1M": 7, "3M": 12, YTD: 25, "1Y": 30 };

export function WorldGlobe({ height = 460, className }: { height?: number; className?: string }) {
  const mounted = useMounted();
  const now = useNow(60_000);
  const [win, setWin] = useState<PerfWindow>("1D");
  const [selected, setSelected] = useState<WorldIndexRow | null>(null);
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const { data, isLoading, error, refetch } = useApi<WorldIndexRow[]>("/api/markets/world", { refetchInterval: 60_000 });
  const rows = useMemo(() => data?.data ?? [], [data]);

  const open = useMemo(
    () => (mounted ? EXCHANGES.filter((e) => exchangeStatus(e, now).state === "open").map((e) => ({ lat: e.lat, lng: e.lng, id: e.id })) : []),
    [mounted, now],
  );

  const ranked = useMemo(() => {
    const v = (r: WorldIndexRow) => (win === "1D" ? r.changePercent : r.perf?.[win]) ?? null;
    return rows
      .filter((r) => r.primary)
      .map((r) => ({ r, v: v(r) }))
      .filter((x) => x.v !== null)
      .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));
  }, [rows, win]);

  return (
    <Panel
      title="World markets"
      icon={<Globe2 className="size-4" />}
      subtitle="Countries shaded by their benchmark index · rings mark exchanges open now"
      meta={data?.meta}
      className={className}
      actions={<Segmented value={win} onChange={setWin} options={WINDOWS} size="xs" />}
    >
      <div className="relative" style={{ height }}>
        <div ref={boxRef} className="absolute inset-0">
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading || !size.width ? (
            <GlobeSkeleton />
          ) : (
            <GlobeInner width={size.width} height={size.height} rows={rows} window={win} openExchanges={open} onSelect={setSelected} />
          )}
        </div>

        <Legend scale={SCALE[win]} win={win} />

        {ranked.length > 0 && (
          <div className="pointer-events-none absolute right-3 top-3 hidden w-44 space-y-2 text-xs md:block">
            <Leaders title="Leaders" items={ranked.slice(0, 4)} />
            <Leaders title="Laggards" items={ranked.slice(-4).reverse()} />
          </div>
        )}

        {selected && (
          <div className="panel absolute bottom-3 left-3 w-72 p-3 shadow-2xl">
            <button onClick={() => setSelected(null)} className="absolute right-2 top-2 text-muted hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="text-xs text-muted">
              {selected.flag} {selected.country} · {selected.exchangeId || selected.region}
            </div>
            <div className="mt-0.5 font-semibold">{selected.label}</div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="num text-xl">{fmtPrice(selected.price)}</div>
                <Change value={selected.changePercent} pill />
              </div>
              <Sparkline data={selected.sparkline} baseline={selected.previousClose} width={110} height={36} />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px]">
              {WINDOWS.map((w) => (
                <div key={w} className="rounded bg-white/5 py-1">
                  <div className="text-muted">{w}</div>
                  <Change value={w === "1D" ? selected.changePercent : selected.perf?.[w]} digits={1} />
                </div>
              ))}
            </div>
            <Link href={`/stock/${encodeURIComponent(selected.symbol)}`} className="btn-ghost mt-3 w-full justify-center text-xs">
              Open chart
            </Link>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Leaders({ title, items }: { title: string; items: { r: WorldIndexRow; v: number | null }[] }) {
  return (
    <div className="rounded-lg border border-line bg-bg/70 p-2 backdrop-blur">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{title}</div>
      {items.map(({ r, v }) => (
        <div key={r.symbol} className="flex items-center justify-between py-0.5">
          <span className="truncate">
            {r.flag} {r.label}
          </span>
          <span className="num" style={{ color: (v ?? 0) >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
            {fmtPct(v, 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend({ scale, win }: { scale: number; win: PerfWindow }) {
  const stops = [-1, -0.5, 0, 0.5, 1];
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-bg/70 px-2 py-1.5 text-[10px] backdrop-blur">
      <div className="mb-1 text-muted">{win} change</div>
      <div className="flex items-center gap-1">
        <span className="num">-{scale}%</span>
        <div className="flex h-2 w-24 overflow-hidden rounded">
          {stops.map((s) => (
            <div key={s} className="flex-1" style={{ background: changeColor(s * scale, scale) }} />
          ))}
        </div>
        <span className="num">+{scale}%</span>
      </div>
    </div>
  );
}
