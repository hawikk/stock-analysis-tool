"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, ChartData, ChartRange } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { bollinger, rsi, sma } from "@/lib/indicators";
import { useTimeZone } from "@/lib/store";
import { tzOffsetMinutes } from "@/lib/time";
import { cn, fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, Skeleton } from "@/components/ui/states";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "Max" },
];

type Overlay = "sma20" | "sma50" | "sma200" | "bb" | "volume" | "rsi";
const OVERLAYS: { id: Overlay; label: string; color: string }[] = [
  { id: "sma20", label: "SMA 20", color: "#f59e0b" },
  { id: "sma50", label: "SMA 50", color: "#a78bfa" },
  { id: "sma200", label: "SMA 200", color: "#f472b6" },
  { id: "bb", label: "Bollinger", color: "#64748b" },
  { id: "volume", label: "Volume", color: "#38bdf8" },
  { id: "rsi", label: "RSI 14", color: "#38bdf8" },
];
const INTRADAY: ChartRange[] = ["1d", "5d", "1mo"];

type Hover = { c: Candle } | null;

export function PriceChart({ symbol, currency }: { symbol: string; currency?: string }) {
  const tz = useTimeZone();
  const [range, setRange] = useState<ChartRange>("1y");
  const [kind, setKind] = useState<"candles" | "area">("candles");
  const [overlays, setOverlays] = useState<Overlay[]>(["sma50", "sma200", "volume"]);
  const [hover, setHover] = useState<Hover>(null);
  const intraday = INTRADAY.includes(range);
  const { data, isLoading, error, refetch } = useApi<ChartData>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`, {
    refetchInterval: range === "1d" ? 30_000 : range === "5d" ? 120_000 : false,
  });

  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType>[]>([]);
  const fitKey = useRef("");

  const candles = useMemo(() => data?.data.candles ?? [], [data]);
  /** lightweight-charts renders UTC; shift timestamps so the axis reads in the viewer's (intraday) or exchange's (daily) wall clock. */
  const shiftTz = intraday ? tz : (data?.data.exchangeTimezone ?? "UTC");
  const shifted = useMemo(() => candles.map((c) => ({ ...c, t: (c.time + tzOffsetMinutes(new Date(c.time * 1000), shiftTz) * 60) as UTCTimestamp })), [candles, shiftTz]);

  useEffect(() => {
    if (!box.current) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7d8aa0",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 11,
        panes: { separatorColor: "#1b2330", separatorHoverColor: "#253042" },
      },
      grid: { vertLines: { color: "rgba(27,35,48,0.5)" }, horzLines: { color: "rgba(27,35,48,0.5)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1b2330" },
      timeScale: { borderColor: "#1b2330", timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !shifted.length) return;
    chart.applyOptions({ timeScale: { timeVisible: intraday } });
    for (const s of seriesRef.current) chart.removeSeries(s);
    seriesRef.current = [];
    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1);

    const closes = shifted.map((c) => c.close);
    const line = (vals: (number | null)[], color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid, pane = 0) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, pane);
      s.setData(shifted.flatMap((c, i) => (vals[i] == null ? [] : [{ time: c.t, value: vals[i] as number }])));
      seriesRef.current.push(s);
      return s;
    };

    const first = shifted[0].close;
    const lastClose = shifted[shifted.length - 1].close;
    const base = range === "1d" ? (data?.data.previousClose ?? first) : first;
    const up = lastClose >= base;

    let main: ISeriesApi<SeriesType>;
    if (kind === "candles") {
      main = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#f43f5e",
      });
      main.setData(shifted.map((c) => ({ time: c.t, open: c.open, high: c.high, low: c.low, close: c.close })));
    } else {
      main = chart.addSeries(AreaSeries, {
        lineColor: up ? "#22c55e" : "#f43f5e",
        topColor: up ? "rgba(34,197,94,0.25)" : "rgba(244,63,94,0.25)",
        bottomColor: "rgba(0,0,0,0)",
        lineWidth: 2,
      });
      main.setData(shifted.map((c) => ({ time: c.t, value: c.close })));
    }
    seriesRef.current.push(main);
    if (range === "1d" && data?.data.previousClose) {
      main.createPriceLine({ price: data.data.previousClose, color: "#7d8aa0", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "Prev close" });
    }

    if (overlays.includes("volume")) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(shifted.map((c) => ({ time: c.t, value: c.volume, color: c.close >= c.open ? "rgba(34,197,94,0.35)" : "rgba(244,63,94,0.35)" })));
      seriesRef.current.push(vol);
    }
    if (overlays.includes("sma20")) line(sma(closes, 20), "#f59e0b");
    if (overlays.includes("sma50")) line(sma(closes, 50), "#a78bfa");
    if (overlays.includes("sma200")) line(sma(closes, 200), "#f472b6");
    if (overlays.includes("bb")) {
      const b = bollinger(closes, 20, 2);
      line(b.upper, "#64748b", 1, LineStyle.Dotted);
      line(b.lower, "#64748b", 1, LineStyle.Dotted);
    }
    if (overlays.includes("rsi")) {
      const r = line(rsi(closes, 14), "#38bdf8", 1, LineStyle.Solid, 1);
      r.createPriceLine({ price: 70, color: "rgba(244,63,94,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      r.createPriceLine({ price: 30, color: "rgba(34,197,94,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      chart.panes()[1]?.setHeight(90);
    }

    const key = `${symbol}:${range}`;
    if (fitKey.current !== key) {
      chart.timeScale().fitContent();
      fitKey.current = key;
    }

    const byTime = new Map(shifted.map((c) => [c.t as number, c]));
    const onMove = (p: { time?: unknown }) => {
      const c = typeof p.time === "number" ? byTime.get(p.time) : undefined;
      setHover(c ? { c } : null);
    };
    chart.subscribeCrosshairMove(onMove);
    return () => chart.unsubscribeCrosshairMove(onMove);
  }, [shifted, kind, overlays, range, symbol, data, intraday]);

  const last = candles[candles.length - 1];
  const ref = range === "1d" ? (data?.data.previousClose ?? candles[0]?.close) : candles[0]?.close;
  const periodChange = last && ref ? ((last.close - ref) / ref) * 100 : null;
  const shown = hover?.c ?? last;

  const toggle = (id: Overlay) => setOverlays((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={range} onChange={setRange} options={RANGES} size="xs" />
          <Segmented
            value={kind}
            onChange={setKind}
            size="xs"
            options={[
              { value: "candles", label: "Candles" },
              { value: "area", label: "Line" },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition",
                overlays.includes(o.id) ? "border-line bg-white/10 text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              <span className="h-0.5 w-3 rounded" style={{ background: o.color }} />
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-[11px] text-muted">
        {shown && (
          <>
            <span>
              O <span className="text-fg">{fmtPrice(shown.open)}</span>
            </span>
            <span>
              H <span className="text-fg">{fmtPrice(shown.high)}</span>
            </span>
            <span>
              L <span className="text-fg">{fmtPrice(shown.low)}</span>
            </span>
            <span>
              C <span className="text-fg">{fmtPrice(shown.close)}</span>
            </span>
            <span>
              Vol <span className="text-fg">{fmtCompact(shown.volume)}</span>
            </span>
          </>
        )}
        {periodChange != null && !hover && (
          <span className={cn("ml-auto", periodChange >= 0 ? "text-up" : "text-down")}>
            {RANGES.find((r) => r.value === range)?.label} {fmtPct(periodChange)} {currency ? `(${currency})` : ""}
          </span>
        )}
      </div>
      <div className="relative h-[440px]">
        <div ref={box} className="absolute inset-0" />
        {isLoading && <Skeleton className="absolute inset-4" />}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-panel">
            <ErrorState message={error.message} onRetry={() => refetch()} />
          </div>
        )}
        {data && !candles.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted">No price history for this range</div>}
      </div>
    </div>
  );
}
