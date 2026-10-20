"use client";

import { Command } from "cmdk";
import { CornerDownLeft, History, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchResult } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { useAllWatchlistSymbols, usePrefs } from "@/lib/store";
import { displaySymbol } from "@/lib/format";
import { NAV } from "./nav";

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const debounced = useDebounced(q.trim());
  const recent = usePrefs((s) => s.recent);
  const watch = useAllWatchlistSymbols();
  const { data, isFetching } = useApi<SearchResult[]>(debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null, { staleTime: 300_000 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const results = data?.data ?? [];
  const upper = q.trim().toUpperCase();

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost h-8 w-full max-w-md justify-between px-3 text-xs text-muted sm:w-72">
        <span className="flex items-center gap-2">
          <Search className="size-3.5" /> Search stocks, ETFs, indices…
        </span>
        <kbd className="hidden rounded border border-line px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <Command
            shouldFilter={false}
            onMouseDown={(e) => e.stopPropagation()}
            className="panel w-full max-w-xl overflow-hidden shadow-2xl"
            label="Search"
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <Command.Input
                autoFocus
                value={q}
                onValueChange={setQ}
                placeholder="Ticker or company — e.g. NVDA, Inditex, ^N225, EURUSD=X"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              {isFetching && <span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />}
            </div>
            <Command.List className="max-h-[55vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">{debounced ? "No matches" : "Start typing to search"}</Command.Empty>
              {upper && /^[A-Z0-9^=.\-]{1,15}$/.test(upper) && (
                <Command.Group heading={<GroupHeading>Go to</GroupHeading>}>
                  <Item onSelect={() => go(`/stock/${encodeURIComponent(upper)}`)} value={`go-${upper}`}>
                    <CornerDownLeft className="size-3.5 text-muted" />
                    <span className="font-medium">{upper}</span>
                    <span className="text-muted">Open quote</span>
                  </Item>
                </Command.Group>
              )}
              {results.length > 0 && (
                <Command.Group heading={<GroupHeading>Securities</GroupHeading>}>
                  {results.map((r) => (
                    <Item key={r.symbol} value={r.symbol} onSelect={() => go(`/stock/${encodeURIComponent(r.symbol)}`)}>
                      <span className="w-24 shrink-0 font-medium">{r.symbol}</span>
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted">
                        {r.type} · {r.exchange}
                      </span>
                    </Item>
                  ))}
                </Command.Group>
              )}
              {!q && recent.length > 0 && (
                <Command.Group heading={<GroupHeading>Recent</GroupHeading>}>
                  {recent.map((s) => (
                    <Item key={s} value={`recent-${s}`} onSelect={() => go(`/stock/${encodeURIComponent(s)}`)}>
                      <History className="size-3.5 text-muted" /> {displaySymbol(s)}
                    </Item>
                  ))}
                </Command.Group>
              )}
              {!q && watch.length > 0 && (
                <Command.Group heading={<GroupHeading>Watchlists</GroupHeading>}>
                  {watch.slice(0, 8).map((s) => (
                    <Item key={s} value={`wl-${s}`} onSelect={() => go(`/stock/${encodeURIComponent(s)}`)}>
                      <Star className="size-3.5 text-amber-300" /> {displaySymbol(s)}
                    </Item>
                  ))}
                </Command.Group>
              )}
              {!q && (
                <Command.Group heading={<GroupHeading>Pages</GroupHeading>}>
                  {NAV.map(({ href, label, icon: Icon }) => (
                    <Item key={href} value={`nav-${href}`} onSelect={() => go(href)}>
                      <Icon className="size-3.5 text-muted" /> {label}
                    </Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted">{children}</span>;
}

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-white/[0.07]"
    >
      {children}
    </Command.Item>
  );
}
