"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_WATCHLISTS } from "@/lib/universe";

export type Watchlist = { id: string; name: string; symbols: string[] };

type Prefs = {
  timeZone: "auto" | string;
  watchlists: Watchlist[];
  activeWatchlist: string;
  recent: string[];
  setTimeZone: (tz: string) => void;
  addToWatchlist: (symbol: string, listId?: string) => void;
  removeFromWatchlist: (symbol: string, listId: string) => void;
  moveInWatchlist: (listId: string, from: number, to: number) => void;
  createWatchlist: (name: string) => string;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
  setActiveWatchlist: (id: string) => void;
  importWatchlists: (lists: Watchlist[]) => void;
  pushRecent: (symbol: string) => void;
};

export const usePrefs = create<Prefs>()(
  persist(
    (set, get) => ({
      timeZone: "auto",
      watchlists: DEFAULT_WATCHLISTS,
      activeWatchlist: DEFAULT_WATCHLISTS[0].id,
      recent: [],
      setTimeZone: (timeZone) => set({ timeZone }),
      addToWatchlist: (symbol, listId) =>
        set((s) => {
          const id = listId ?? s.activeWatchlist;
          return {
            watchlists: s.watchlists.map((w) => (w.id === id && !w.symbols.includes(symbol) ? { ...w, symbols: [...w.symbols, symbol] } : w)),
          };
        }),
      removeFromWatchlist: (symbol, listId) =>
        set((s) => ({ watchlists: s.watchlists.map((w) => (w.id === listId ? { ...w, symbols: w.symbols.filter((x) => x !== symbol) } : w)) })),
      moveInWatchlist: (listId, from, to) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) => {
            if (w.id !== listId) return w;
            const symbols = [...w.symbols];
            const [moved] = symbols.splice(from, 1);
            symbols.splice(to, 0, moved);
            return { ...w, symbols };
          }),
        })),
      createWatchlist: (name) => {
        const id = `wl-${Date.now().toString(36)}`;
        set((s) => ({ watchlists: [...s.watchlists, { id, name, symbols: [] }], activeWatchlist: id }));
        return id;
      },
      renameWatchlist: (id, name) => set((s) => ({ watchlists: s.watchlists.map((w) => (w.id === id ? { ...w, name } : w)) })),
      deleteWatchlist: (id) =>
        set((s) => {
          const watchlists = s.watchlists.filter((w) => w.id !== id);
          return { watchlists, activeWatchlist: s.activeWatchlist === id ? (watchlists[0]?.id ?? "") : s.activeWatchlist };
        }),
      setActiveWatchlist: (activeWatchlist) => set({ activeWatchlist }),
      importWatchlists: (lists) => set({ watchlists: lists, activeWatchlist: lists[0]?.id ?? "" }),
      pushRecent: (symbol) => set({ recent: [symbol, ...get().recent.filter((s) => s !== symbol)].slice(0, 8) }),
    }),
    { name: "market-terminal:prefs", version: 1 },
  ),
);

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useTimeZone(): string {
  const tz = usePrefs((s) => s.timeZone);
  return tz === "auto" ? detectTimeZone() : tz;
}

export function useAllWatchlistSymbols(): string[] {
  const lists = usePrefs((s) => s.watchlists);
  return [...new Set(lists.flatMap((w) => w.symbols))];
}
