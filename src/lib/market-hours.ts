import type { Exchange } from "@/lib/universe";
import { addDays, isoDateInTz, weekdayOf, zonedTimeToUtc } from "@/lib/time";

export type Interval = { start: number; end: number };

export type ExchangeStatus = {
  state: "open" | "closed" | "break";
  /** Epoch ms of the next open/close transition. */
  nextChange: number;
  nextLabel: "opens" | "closes" | "reopens";
};

/** Trading sessions (epoch ms) whose local trading date falls within [-dayBefore, +daysAfter] of `now`. */
export function sessionsAround(ex: Exchange, now: number, daysBefore = 1, daysAfter = 7): Interval[] {
  const today = isoDateInTz(new Date(now), ex.timeZone);
  const out: Interval[] = [];
  for (let d = -daysBefore; d <= daysAfter; d++) {
    const date = addDays(today, d);
    if (!ex.days.includes(weekdayOf(date))) continue;
    for (const s of ex.sessions) {
      out.push({
        start: zonedTimeToUtc(date, s.open, ex.timeZone).getTime(),
        end: zonedTimeToUtc(date, s.close, ex.timeZone).getTime(),
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function exchangeStatus(ex: Exchange, now: number): ExchangeStatus {
  const sessions = sessionsAround(ex, now);
  const current = sessions.find((s) => s.start <= now && now < s.end);
  if (current) return { state: "open", nextChange: current.end, nextLabel: "closes" };
  const next = sessions.find((s) => s.start > now);
  const prev = [...sessions].reverse().find((s) => s.end <= now);
  const isBreak = !!next && !!prev && isoDateInTz(new Date(prev.start), ex.timeZone) === isoDateInTz(new Date(next.start), ex.timeZone);
  return {
    state: isBreak ? "break" : "closed",
    nextChange: next?.start ?? now + 86400000,
    nextLabel: isBreak ? "reopens" : "opens",
  };
}

/** Local wall-clock time at the exchange. */
export function exchangeLocalTime(ex: Exchange, now: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: ex.timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(now));
}
