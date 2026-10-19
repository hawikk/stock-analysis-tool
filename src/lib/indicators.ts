import type { Candle } from "@/lib/types";

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
      } else out.push(null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    }
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line = values.map((_, i) => (f[i] !== null && s[i] !== null ? (f[i] as number) - (s[i] as number) : null));
  const firstIdx = line.findIndex((v) => v !== null);
  const sig: (number | null)[] = new Array(values.length).fill(null);
  if (firstIdx >= 0) {
    const compact = ema(line.slice(firstIdx) as number[], signal);
    compact.forEach((v, i) => (sig[firstIdx + i] = v));
  }
  const hist = line.map((v, i) => (v !== null && sig[i] !== null ? v - (sig[i] as number) : null));
  return { line, signal: sig, hist };
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const m = mid[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((a, v) => a + (v - m) ** 2, 0) / period);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const trs = candles.slice(1).map((c, i) => {
    const pc = candles[i].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

export function pctReturn(values: number[], lookback: number): number | null {
  if (values.length <= lookback) return null;
  const a = values[values.length - 1 - lookback];
  const b = values[values.length - 1];
  return a ? (b / a - 1) * 100 : null;
}

export function realizedVol(values: number[], window = 30, periodsPerYear = 252): number | null {
  if (values.length < window + 1) return null;
  const rets = values.slice(-window - 1).slice(1).map((v, i, arr) => Math.log(v / (i === 0 ? values[values.length - window - 1] : arr[i - 1])));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance * periodsPerYear) * 100;
}

export function maxDrawdown(values: number[]): number | null {
  if (!values.length) return null;
  let peak = values[0];
  let mdd = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd * 100;
}

/** Recent swing highs/lows, clustered, nearest to price first. */
export function supportResistance(candles: Candle[], price: number, window = 5) {
  const recent = candles.slice(-180);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = window; i < recent.length - window; i++) {
    const slice = recent.slice(i - window, i + window + 1);
    if (recent[i].high === Math.max(...slice.map((c) => c.high))) highs.push(recent[i].high);
    if (recent[i].low === Math.min(...slice.map((c) => c.low))) lows.push(recent[i].low);
  }
  const cluster = (levels: number[]) => {
    const sorted = [...levels].sort((a, b) => a - b);
    const out: number[] = [];
    for (const l of sorted) {
      const last = out[out.length - 1];
      if (last && Math.abs(l / last - 1) < 0.015) out[out.length - 1] = (last + l) / 2;
      else out.push(l);
    }
    return out;
  };
  const support = cluster(lows.filter((l) => l < price)).sort((a, b) => b - a).slice(0, 3);
  const resistance = cluster(highs.filter((h) => h > price)).sort((a, b) => a - b).slice(0, 3);
  return { support, resistance };
}

export const last = <T,>(arr: (T | null)[]): T | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};
