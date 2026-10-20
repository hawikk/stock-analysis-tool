"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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
