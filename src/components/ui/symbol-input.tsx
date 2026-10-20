"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/format";
import { SYMBOL_PATTERN } from "@/lib/symbols";

/** Ticker input with Yahoo-backed autocomplete; Enter adds the highlighted match or the raw ticker. */
export function SymbolInput({ onPick, placeholder = "Add symbol…", className }: { onPick: (symbol: string) => void; placeholder?: string; className?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const { data } = useApi<SearchResult[]>(debounced.length >= 1 ? `/api/search?q=${encodeURIComponent(debounced)}` : null, { staleTime: 300_000 });
  const results = (data?.data ?? []).slice(0, 8);

  const pick = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(s)) return;
    onPick(s);
    setQ("");
    setDebounced("");
    setOpen(false);
    setIdx(0);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[idx]?.symbol ?? q);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="input w-full pl-8 pr-8"
        aria-label="Symbol"
      />
      <button onClick={() => pick(results[idx]?.symbol ?? q)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-white/10 hover:text-fg" aria-label="Add">
        <Plus className="size-3.5" />
      </button>
      {open && results.length > 0 && (
        <ul className="panel absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto p-1 shadow-2xl">
          {results.map((r, i) => (
            <li key={r.symbol}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(r.symbol)}
                className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm", i === idx && "bg-white/[0.06]")}
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.symbol}</span>
                  <span className="ml-2 truncate text-xs text-muted">{r.name}</span>
                </span>
                <span className="shrink-0 text-[10px] text-muted">
                  {r.type} · {r.exchange}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
