"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";
import type { EarningsEvent, EconomicEvent } from "@/lib/types";
import { useApi, useMounted, useNow } from "@/lib/hooks";
import { useAllWatchlistSymbols, useTimeZone } from "@/lib/store";
import { addDays, isoDateInTz } from "@/lib/time";
import { earningsLocalTime, flagFor, IMPACT_STYLE, timingShort } from "@/lib/calendar";
import { cn, fmtCompact, fmtDate, fmtTime } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";

type Tab = "earnings" | "economy";

export function UpcomingEvents({ className, limit = 10 }: { className?: string; limit?: number }) {
  const mounted = useMounted();
  const tz = useTimeZone();
  const [tab, setTab] = useState<Tab>("earnings");
  const now = useNow(60_000);
  const from = mounted ? isoDateInTz(new Date(now), "America/New_York") : "";
  const to = mounted ? addDays(from, 7) : "";
  return (
    <Panel
      title="Coming up"
      icon={<CalendarClock className="size-4" />}
      subtitle={mounted ? `Next 7 days · times in ${tz.replace(/_/g, " ")}` : "Next 7 days"}
      className={className}
      actions={
        <Segmented
          value={tab}
          onChange={setTab}
          size="xs"
          options={[
            { value: "earnings", label: "Earnings" },
            { value: "economy", label: "Economy" },
          ]}
        />
      }
    >
      {!mounted ? (
        <SkeletonRows rows={6} />
      ) : tab === "earnings" ? (
        <EarningsList from={from} to={to} tz={tz} limit={limit} now={now} />
      ) : (
        <EconList from={from} to={to} tz={tz} limit={limit} now={now} />
      )}
      <div className="border-t border-line px-4 py-2 text-right">
        <Link href="/calendar" className="text-xs text-accent hover:underline">
          Full calendar
        </Link>
      </div>
    </Panel>
  );
}

function EarningsList({ from, to, tz, limit, now }: { from: string; to: string; tz: string; limit: number; now: number }) {
  const watch = useAllWatchlistSymbols();
  const { data, isLoading, error, refetch } = useApi<EarningsEvent[]>(`/api/calendar/earnings?from=${from}&to=${to}`, { staleTime: 600_000 });
  const rows = useMemo(() => {
    const cutoff = now - 6 * 3600_000;
    const list = (data?.data ?? []).filter((e) => new Date(e.approxTime).getTime() >= cutoff);
    const watched = list.filter((e) => watch.includes(e.symbol));
    const rest = list.filter((e) => !watch.includes(e.symbol) && (e.marketCap ?? 0) > 50e9);
    return [...watched, ...rest].sort((a, b) => a.approxTime.localeCompare(b.approxTime)).slice(0, limit);
  }, [data, watch, limit, now]);
  if (isLoading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!rows.length) return <EmptyState title="No large-cap reports this week" />;
  return (
    <ul className="divide-y divide-line/60">
      {rows.map((e) => (
        <li key={`${e.symbol}-${e.date}`}>
          <Link href={`/stock/${encodeURIComponent(e.symbol)}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-white/[0.03]">
            <span className="w-14 shrink-0 text-xs text-muted">{fmtDate(e.approxTime, tz, { weekday: "short", day: "numeric" })}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                {e.symbol}
                {watch.includes(e.symbol) && <span className="rounded bg-accent/15 px-1 text-[10px] text-accent">watchlist</span>}
              </span>
              <span className="block truncate text-[11px] text-muted">{e.name}</span>
            </span>
            <span className="text-right text-xs">
              <span className="num block">{earningsLocalTime(e.approxTime, e.timing, tz) ?? "—"}</span>
              <span className="block text-[10px] text-muted">
                {timingShort(e.timing)} · {fmtCompact(e.marketCap, "$")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EconList({ from, to, tz, limit, now }: { from: string; to: string; tz: string; limit: number; now: number }) {
  const { data, isLoading, error, refetch } = useApi<EconomicEvent[]>(`/api/calendar/economic?from=${from}&to=${to}`, { staleTime: 600_000 });
  const rows = useMemo(() => {
    const cutoff = now - 3600_000;
    return (data?.data ?? []).filter((e) => e.impact === "high" && !e.allDay && new Date(e.time).getTime() >= cutoff).slice(0, limit);
  }, [data, limit, now]);
  if (isLoading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!rows.length) return <EmptyState title="No high-impact releases ahead this week" />;
  return (
    <ul className="divide-y divide-line/60">
      {rows.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
          <span className="w-14 shrink-0 text-xs text-muted">
            {fmtDate(e.time, tz, { weekday: "short", day: "numeric" })}
            <span className="num block text-fg">{fmtTime(e.time, tz)}</span>
          </span>
          <span className={cn("size-1.5 shrink-0 rounded-full", IMPACT_STYLE[e.impact].dot)} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{e.title}</span>
            <span className="block text-[11px] text-muted">
              {flagFor(e.country)} {e.country}
            </span>
          </span>
          <span className="num text-right text-[11px] text-muted">
            {e.actual ? <span className="block text-fg">{e.actual}</span> : null}
            {e.forecast ? <span className="block">f {e.forecast}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
