"use client";

import { Check, Clock, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectTimeZone, usePrefs, useTimeZone } from "@/lib/store";
import { useMounted, useNow } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { tzAbbreviation } from "@/lib/time";

const POPULAR = ["Europe/Madrid", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Tokyo", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney", "UTC"];

function allZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return POPULAR;
  }
}

export function TimezonePicker() {
  const mounted = useMounted();
  const tz = useTimeZone();
  const pref = usePrefs((s) => s.timeZone);
  const setTz = usePrefs((s) => s.setTimeZone);
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const zones = useMemo(() => {
    const list = q ? allZones().filter((z) => z.toLowerCase().includes(q.toLowerCase().replace(/ /g, "_"))) : POPULAR;
    return list.slice(0, 60);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!mounted) return <div className="h-8 w-36" />;

  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost h-8 gap-2 px-2.5 text-xs" aria-label="Change time zone">
        <Clock className="size-3.5 text-accent" />
        <span className="num">{time}</span>
        <span className="hidden text-muted sm:inline">{tzAbbreviation(tz, new Date(now))}</span>
      </button>
      {open && (
        <div className="panel absolute right-0 z-50 mt-2 w-72 p-2 shadow-2xl">
          <p className="px-2 pb-2 pt-1 text-[11px] text-muted">
            All times (earnings, economic events, market hours) are shown in this zone.
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search time zones…" className="input w-full pl-8 text-xs" />
          </div>
          <div className="max-h-72 overflow-y-auto">
            <ZoneButton label={`Auto · ${detectTimeZone()}`} active={pref === "auto"} onClick={() => (setTz("auto"), setOpen(false))} />
            {zones.map((z) => (
              <ZoneButton key={z} label={z.replace(/_/g, " ")} hint={tzAbbreviation(z)} active={pref === z} onClick={() => (setTz(z), setOpen(false))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneButton({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5", active && "text-accent")}>
      <span className="flex items-center gap-2">
        <Check className={cn("size-3.5", active ? "opacity-100" : "opacity-0")} />
        {label}
      </span>
      {hint && <span className="text-muted">{hint}</span>}
    </button>
  );
}
