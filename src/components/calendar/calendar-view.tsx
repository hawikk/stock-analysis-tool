"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Globe2, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { EarningsEvent, EconomicEvent, EconomicImpact } from "@/lib/types";
import { useApi, useMounted, useNow } from "@/lib/hooks";
import { useAllWatchlistSymbols, useTimeZone } from "@/lib/store";
import { addDays, isoDateInTz, tzAbbreviation, weekdayOf } from "@/lib/time";
import { earningsLocalTime, flagFor, IMPACT_STYLE, timingLabel, timingShort } from "@/lib/calendar";
import { cn, fmtCompact, fmtDate, fmtTime } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from "@/components/ui/states";
import { TimezonePicker } from "@/components/shell/timezone-picker";

type Tab = "earnings" | "economic";
type EarningsFilter = "all" | "watchlist" | "large";

const dayLabel = (date: string) => fmtDate(`${date}T12:00:00Z`, "UTC", { weekday: "long", month: "short", day: "numeric" });

export function CalendarView() {
  const mounted = useMounted();
  const now = useNow(60_000);
  const tz = useTimeZone();
  const [tab, setTab] = useState<Tab>("earnings");
  const [week, setWeek] = useState(0);

  const today = mounted ? isoDateInTz(new Date(now), tz) : "";
  const monday = today ? addDays(today, -((weekdayOf(today) + 6) % 7) + week * 7) : "";
  const sunday = monday ? addDays(monday, 6) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted">
            Earnings and economic releases converted to your timezone{mounted ? ` (${tzAbbreviation(tz)})` : ""}. Change it any time:
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TimezonePicker />
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "earnings", label: "Earnings" },
              { value: "economic", label: "Economic" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => setWeek((w) => w - 1)} aria-label="Previous week">
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-48 text-center text-sm font-medium">
          {monday ? `${fmtDate(`${monday}T12:00:00Z`, "UTC", { month: "short", day: "numeric" })} – ${fmtDate(`${sunday}T12:00:00Z`, "UTC", { month: "short", day: "numeric", year: "numeric" })}` : <Skeleton className="mx-auto h-4 w-40" />}
        </div>
        <button className="btn-ghost" onClick={() => setWeek((w) => w + 1)} aria-label="Next week">
          <ChevronRight className="size-4" />
        </button>
        {week !== 0 && (
          <button className="btn-ghost text-xs" onClick={() => setWeek(0)}>
            This week
          </button>
        )}
      </div>

      {!mounted ? (
        <Panel>
          <SkeletonRows rows={10} />
        </Panel>
      ) : tab === "earnings" ? (
        <EarningsCalendar from={monday} to={sunday} tz={tz} today={today} />
      ) : (
        <EconomicCalendar from={monday} to={sunday} tz={tz} today={today} now={now} />
      )}
    </div>
  );
}

function EarningsCalendar({ from, to, tz, today }: { from: string; to: string; tz: string; today: string }) {
  const watch = useAllWatchlistSymbols();
  const [filter, setFilter] = useState<EarningsFilter>("large");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data, isLoading, error, refetch } = useApi<EarningsEvent[]>(`/api/calendar/earnings?from=${addDays(from, -1)}&to=${to}`, { staleTime: 600_000 });

  const days = useMemo(() => {
    const query = q.trim().toUpperCase();
    const list = (data?.data ?? []).filter((e) => {
      if (query) return e.symbol.includes(query) || e.name.toUpperCase().includes(query);
      if (filter === "watchlist") return watch.includes(e.symbol);
      if (filter === "large") return (e.marketCap ?? 0) >= 10e9 || watch.includes(e.symbol);
      return true;
    });
    const by = new Map<string, EarningsEvent[]>();
    for (const e of list) {
      const local = e.timing === "unknown" ? e.date : isoDateInTz(new Date(e.approxTime), tz);
      if (local < from || local > to) continue;
      by.set(local, [...(by.get(local) ?? []), e]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => Number(watch.includes(b.symbol)) - Number(watch.includes(a.symbol)) || (b.marketCap ?? 0) - (a.marketCap ?? 0)),
      }));
  }, [data, filter, q, watch, tz, from, to]);

  const total = days.reduce((a, d) => a + d.events.length, 0);

  return (
    <Panel
      title="Earnings"
      icon={<TrendingUp className="size-4" />}
      subtitle={data ? `${total} reports · BMO ≈ 08:00 ET, AMC ≈ 16:05 ET, shown in your time` : "US-listed companies"}
      meta={data?.meta}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find ticker" className="input w-36 py-1 pl-7 text-xs" />
          </label>
          <Segmented
            value={filter}
            onChange={setFilter}
            size="xs"
            options={[
              { value: "large", label: "Large caps" },
              { value: "watchlist", label: "Watchlist" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
      }
    >
      {isLoading && <SkeletonRows rows={10} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && days.length === 0 && (
        <EmptyState title={filter === "watchlist" ? "None of your watchlist reports this week" : "No reports match"} hint="Try another filter or week." icon={<CalendarDays className="size-6" />} />
      )}
      <div className="grid gap-px bg-line/60 md:grid-cols-2 xl:grid-cols-3">
        {days.map(({ date, events }) => {
          const open = expanded[date];
          const shown = open ? events : events.slice(0, 12);
          return (
            <section key={date} className="bg-panel">
              <header className={cn("flex items-center justify-between px-4 py-2 text-xs", date === today ? "bg-accent/10 text-accent" : "bg-panel-2/60 text-muted")}>
                <span className="font-semibold uppercase tracking-wide">{dayLabel(date)}</span>
                <span>
                  {date === today && "Today · "}
                  {events.length} reports
                </span>
              </header>
              <ul className="divide-y divide-line/50">
                {shown.map((e) => (
                  <li key={e.symbol}>
                    <Link href={`/stock/${encodeURIComponent(e.symbol)}`} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 text-sm hover:bg-white/[0.03]">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold">{e.symbol}</span>
                          {watch.includes(e.symbol) && <span className="rounded bg-accent/15 px-1 text-[10px] text-accent">watchlist</span>}
                          <span className="truncate text-xs text-muted">{e.name}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          EPS est <span className="num text-fg">{e.epsEstimate?.toFixed(2) ?? "—"}</span> · last yr <span className="num">{e.lastYearEps?.toFixed(2) ?? "—"}</span> · {fmtCompact(e.marketCap, "$")}
                        </span>
                      </span>
                      <span className="text-right" title={timingLabel(e.timing)}>
                        <span className="num block text-sm">{earningsLocalTime(e.approxTime, e.timing, tz) ?? "—"}</span>
                        <span className={cn("block text-[10px] font-medium", e.timing === "bmo" ? "text-amber-300" : e.timing === "amc" ? "text-violet-300" : "text-muted")}>{timingShort(e.timing)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {events.length > 12 && (
                <button onClick={() => setExpanded((x) => ({ ...x, [date]: !open }))} className="w-full border-t border-line/60 py-1.5 text-xs text-accent hover:bg-white/[0.03]">
                  {open ? "Show fewer" : `Show all ${events.length}`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

const MAJOR = ["United States", "Euro Zone", "Germany", "United Kingdom", "Japan", "China", "Spain", "France", "Italy", "Canada", "Switzerland", "Australia"];
const IMPACTS: EconomicImpact[] = ["high", "medium", "low"];

function EconomicCalendar({ from, to, tz, today, now }: { from: string; to: string; tz: string; today: string; now: number }) {
  const [impacts, setImpacts] = useState<EconomicImpact[]>(["high", "medium"]);
  const [countries, setCountries] = useState<string[]>([]);
  const { data, isLoading, error, refetch } = useApi<EconomicEvent[]>(`/api/calendar/economic?from=${addDays(from, -1)}&to=${addDays(to, 1)}`, { staleTime: 300_000 });

  const available = useMemo(() => {
    const set = new Set((data?.data ?? []).map((e) => e.country));
    return [...MAJOR.filter((c) => set.has(c)), ...[...set].filter((c) => !MAJOR.includes(c)).sort()];
  }, [data]);

  const days = useMemo(() => {
    const by = new Map<string, EconomicEvent[]>();
    for (const e of data?.data ?? []) {
      if (!impacts.includes(e.impact)) continue;
      if (countries.length && !countries.includes(e.country)) continue;
      const local = isoDateInTz(new Date(e.time), tz);
      if (local < from || local > to) continue;
      by.set(local, [...(by.get(local) ?? []), e]);
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, events]) => ({ date, events: events.sort((a, b) => a.time.localeCompare(b.time)) }));
  }, [data, impacts, countries, tz, from, to]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const nextId = days.flatMap((d) => d.events).find((e) => !e.allDay && new Date(e.time).getTime() > now)?.id;

  return (
    <Panel
      title="Economic calendar"
      icon={<Globe2 className="size-4" />}
      subtitle="Central banks, inflation, jobs, growth and sentiment releases"
      meta={data?.meta}
      actions={
        <div className="flex items-center gap-1">
          {IMPACTS.map((i) => (
            <button
              key={i}
              onClick={() => setImpacts((x) => toggle(x, i))}
              className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]", impacts.includes(i) ? "border-line bg-white/10 text-fg" : "border-transparent text-muted")}
            >
              <span className={cn("size-1.5 rounded-full", IMPACT_STYLE[i].dot)} />
              {IMPACT_STYLE[i].label}
            </button>
          ))}
        </div>
      }
    >
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          <button onClick={() => setCountries([])} className={cn("rounded-md px-2 py-0.5 text-[11px]", countries.length === 0 ? "bg-accent/15 text-accent" : "text-muted hover:text-fg")}>
            All countries
          </button>
          {available.map((c) => (
            <button
              key={c}
              onClick={() => setCountries((x) => toggle(x, c))}
              className={cn("rounded-md px-2 py-0.5 text-[11px]", countries.includes(c) ? "bg-accent/15 text-accent" : "text-muted hover:text-fg")}
            >
              {flagFor(c)} {c}
            </button>
          ))}
        </div>
      )}
      {isLoading && <SkeletonRows rows={10} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && days.length === 0 && <EmptyState title="No releases match these filters" icon={<CalendarDays className="size-6" />} />}
      {days.map(({ date, events }) => (
        <section key={date}>
          <header className={cn("sticky top-0 z-[1] flex items-center justify-between border-y border-line px-4 py-1.5 text-xs backdrop-blur", date === today ? "bg-accent/10 text-accent" : "bg-panel-2/95 text-muted")}>
            <span className="font-semibold uppercase tracking-wide">{dayLabel(date)}</span>
            <span>{events.length} events</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {events.map((e) => {
                  const past = new Date(e.time).getTime() < now;
                  const beat = compareActual(e.actual, e.forecast);
                  return (
                    <tr key={e.id} className={cn("table-row", e.id === nextId && "bg-accent/[0.06]", past && !e.actual && "opacity-70")} title={e.description}>
                      <td className="num w-20 px-4 py-2 text-xs">{e.allDay ? <span className="text-muted">All day</span> : fmtTime(e.time, tz)}</td>
                      <td className="w-6 px-1">
                        <span className={cn("block size-2 rounded-full", IMPACT_STYLE[e.impact].dot)} title={`${IMPACT_STYLE[e.impact].label} impact`} />
                      </td>
                      <td className="w-40 px-2 text-xs text-muted">
                        {flagFor(e.country)} {e.country}
                      </td>
                      <td className="px-2">
                        <span className={cn(e.impact === "high" && "font-medium")}>{e.title}</span>
                        {e.id === nextId && <span className="ml-2 rounded bg-accent/20 px-1.5 py-px text-[10px] text-accent">Next</span>}
                      </td>
                      <td className={cn("num w-20 px-2 text-right text-xs font-medium", beat === 1 ? "text-amber-300" : beat === -1 ? "text-sky-300" : "text-fg")}>{e.actual ?? "—"}</td>
                      <td className="num w-20 px-2 text-right text-xs text-muted">{e.forecast ?? "—"}</td>
                      <td className="num w-20 px-4 text-right text-xs text-muted">{e.previous ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {days.length > 0 && <div className="px-4 py-2 text-right text-[10px] text-muted">Columns: actual (amber above / blue below forecast) · forecast · previous</div>}
    </Panel>
  );
}

function compareActual(actual?: string | null, forecast?: string | null): -1 | 0 | 1 {
  const n = (s?: string | null) => (s ? Number(s.replace(/[^0-9.\-]/g, "")) : NaN);
  const a = n(actual);
  const f = n(forecast);
  if (!Number.isFinite(a) || !Number.isFinite(f) || a === f) return 0;
  return a > f ? 1 : -1;
}
