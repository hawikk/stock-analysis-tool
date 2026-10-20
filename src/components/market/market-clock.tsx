"use client";

import { Clock } from "lucide-react";
import { useMemo } from "react";
import { useMounted, useNow } from "@/lib/hooks";
import { exchangeLocalTime, exchangeStatus, sessionsAround, type ExchangeStatus } from "@/lib/market-hours";
import { useTimeZone } from "@/lib/store";
import { tzAbbreviation, zonedTimeToUtc, isoDateInTz } from "@/lib/time";
import { EXCHANGES, type Exchange } from "@/lib/universe";
import { cn, fmtDuration, fmtTime } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { SkeletonRows } from "@/components/ui/states";

const STATE_STYLE: Record<ExchangeStatus["state"], { dot: string; text: string; label: string }> = {
  open: { dot: "bg-up shadow-[0_0_8px] shadow-up/70", text: "text-up", label: "Open" },
  break: { dot: "bg-warn", text: "text-warn", label: "Lunch" },
  closed: { dot: "bg-slate-600", text: "text-muted", label: "Closed" },
};

const COMPACT_IDS = ["NYSE", "TSX", "B3", "LSE", "XETRA", "BME", "SIX", "TSE", "HKEX", "SSE", "NSE", "ASX"];

function useStatuses(ids?: string[]) {
  const now = useNow(15_000);
  const list = ids ? EXCHANGES.filter((e) => ids.includes(e.id)) : EXCHANGES;
  return { now, rows: list.map((ex) => ({ ex, status: exchangeStatus(ex, now) })) };
}

export function MarketClockList({ className, ids = COMPACT_IDS }: { className?: string; ids?: string[] }) {
  const mounted = useMounted();
  const { now, rows } = useStatuses(ids);
  const openCount = rows.filter((r) => r.status.state === "open").length;
  return (
    <Panel title="Market hours" icon={<Clock className="size-4" />} subtitle={mounted ? `${openCount} of ${rows.length} major venues open` : "Exchange sessions"} className={className}>
      {!mounted ? (
        <SkeletonRows rows={8} />
      ) : (
        <ul className="divide-y divide-line/60">
          {rows.map(({ ex, status }) => (
            <li key={ex.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className={cn("size-2 shrink-0 rounded-full", STATE_STYLE[status.state].dot)} />
              <span className="w-6 text-base leading-none">{ex.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{ex.name}</span>
                <span className="block text-[11px] text-muted">
                  {ex.city} · <span className="num">{exchangeLocalTime(ex, now)}</span>
                </span>
              </span>
              <span className="text-right text-xs">
                <span className={cn("block font-medium", STATE_STYLE[status.state].text)}>{STATE_STYLE[status.state].label}</span>
                <span className="num block text-muted">
                  {status.nextLabel} in {fmtDuration(status.nextChange - now)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** 24h strip in the viewer's timezone showing each venue's sessions, with a live "now" marker. */
export function MarketTimeline({ className }: { className?: string }) {
  const mounted = useMounted();
  const tz = useTimeZone();
  const { now, rows } = useStatuses();

  const { dayStart, dayEnd } = useMemo(() => {
    const today = isoDateInTz(new Date(now), tz);
    const start = zonedTimeToUtc(today, "00:00", tz).getTime();
    return { dayStart: start, dayEnd: start + 24 * 3600_000 };
  }, [now, tz]);

  const pct = (t: number) => ((t - dayStart) / (dayEnd - dayStart)) * 100;
  const hours = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <Panel
      title="Global trading day"
      icon={<Clock className="size-4" />}
      subtitle={mounted ? `Sessions shown in your time (${tz.replace(/_/g, " ")} · ${tzAbbreviation(tz)})` : "Sessions in your local time"}
      className={className}
    >
      {!mounted ? (
        <SkeletonRows rows={10} />
      ) : (
        <div className="overflow-x-auto p-4">
          <div className="min-w-[640px]">
            <div className="relative ml-36 h-5 text-[10px] text-muted">
              {hours.map((h) => (
                <span key={h} className="num absolute -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-36 right-0">
                {hours.map((h) => (
                  <div key={h} className="absolute inset-y-0 border-l border-line/50" style={{ left: `${(h / 24) * 100}%` }} />
                ))}
                <div className="absolute inset-y-0 z-10 w-px bg-accent shadow-[0_0_10px] shadow-accent" style={{ left: `${pct(now)}%` }}>
                  <span className="num absolute -top-1 left-1 rounded bg-accent px-1 text-[10px] font-semibold text-slate-950">{fmtTime(new Date(now), tz)}</span>
                </div>
              </div>
              {rows.map(({ ex, status }) => (
                <TimelineRow key={ex.id} ex={ex} status={status} now={now} dayStart={dayStart} dayEnd={dayEnd} pct={pct} tz={tz} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function TimelineRow({
  ex,
  status,
  now,
  dayStart,
  dayEnd,
  pct,
  tz,
}: {
  ex: Exchange;
  status: ExchangeStatus;
  now: number;
  dayStart: number;
  dayEnd: number;
  pct: (t: number) => number;
  tz: string;
}) {
  const segments = sessionsAround(ex, now, 2, 2)
    .filter((s) => s.end > dayStart && s.start < dayEnd)
    .map((s) => ({ start: Math.max(s.start, dayStart), end: Math.min(s.end, dayEnd), raw: s }));
  return (
    <div className="flex h-8 items-center">
      <div className="flex w-36 shrink-0 items-center gap-2 pr-3 text-xs">
        <span className={cn("size-1.5 shrink-0 rounded-full", STATE_STYLE[status.state].dot)} />
        <span>{ex.flag}</span>
        <span className="truncate font-medium">{ex.name}</span>
      </div>
      <div className="relative h-4 flex-1 rounded bg-white/[0.025]">
        {segments.length === 0 && <span className="absolute inset-0 grid place-items-center text-[10px] text-muted">No session today</span>}
        {segments.map((s) => {
          const active = s.raw.start <= now && now < s.raw.end;
          const past = s.raw.end <= now;
          return (
            <div
              key={s.raw.start}
              title={`${ex.name}: ${fmtTime(new Date(s.raw.start), tz)}–${fmtTime(new Date(s.raw.end), tz)}`}
              className={cn(
                "absolute inset-y-0 rounded",
                active ? "bg-gradient-to-r from-up/50 to-up/80 ring-1 ring-up/60" : past ? "bg-slate-600/30" : "bg-accent/30",
              )}
              style={{ left: `${pct(s.start)}%`, width: `${Math.max(0.6, pct(s.end) - pct(s.start))}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
