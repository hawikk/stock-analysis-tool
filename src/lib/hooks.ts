"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ApiResponse } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function fetchApi<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as ApiResponse<T>;
}

export function useApi<T>(url: string | null, opts: { refetchInterval?: number | false; staleTime?: number } = {}) {
  return useQuery({
    queryKey: [url],
    queryFn: () => fetchApi<T>(url as string),
    enabled: !!url,
    refetchInterval: opts.refetchInterval ?? false,
    staleTime: opts.staleTime ?? 15_000,
    refetchIntervalInBackground: false,
  });
}

const subscribeNoop = () => () => {};

/** True only after hydration; use to gate UI that depends on localStorage or the browser clock/timezone. */
export function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

type Clock = { now: number; subs: Set<() => void>; timer?: ReturnType<typeof setInterval> };
const clocks = new Map<number, Clock>();

function clockFor(intervalMs: number): Clock {
  let c = clocks.get(intervalMs);
  if (!c) {
    c = { now: Date.now(), subs: new Set() };
    clocks.set(intervalMs, c);
  }
  return c;
}

function subscribeClock(intervalMs: number, cb: () => void) {
  const c = clockFor(intervalMs);
  if (c.subs.size === 0) {
    c.now = Date.now();
    c.timer = setInterval(() => {
      c.now = Date.now();
      c.subs.forEach((fn) => fn());
    }, intervalMs);
  }
  c.subs.add(cb);
  return () => {
    c.subs.delete(cb);
    if (c.subs.size === 0) clearInterval(c.timer);
  };
}

/**
 * Shared ticking clock. Returns 0 during prerender/hydration (Cache Components forbids reading the
 * current time while prerendering), so callers should gate time-dependent UI on `useMounted()`.
 */
export function useNow(intervalMs = 1000) {
  const subscribe = useCallback((cb: () => void) => subscribeClock(intervalMs, cb), [intervalMs]);
  return useSyncExternalStore(
    subscribe,
    () => clockFor(intervalMs).now,
    () => 0,
  );
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Remembers the previous value of a number to drive up/down price flashes. */
export function usePriceFlash(value: number | null | undefined) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const id = setTimeout(() => setFlash(null), 900);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);
  return flash;
}
