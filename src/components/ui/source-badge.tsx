import type { DataSource, Meta } from "@/lib/types";
import { cn } from "@/lib/format";

const LABELS: Record<DataSource, string> = {
  yahoo: "Yahoo",
  nasdaq: "Nasdaq",
  treasury: "US Treasury",
  cnbc: "CNBC",
  coingecko: "CoinGecko",
  finnhub: "Finnhub",
  fred: "FRED",
  forexfactory: "ForexFactory",
  ai: "AI",
  quant: "Quant",
  mock: "Demo data",
};

export function SourceBadge({ meta, className }: { meta: Meta; className?: string }) {
  const sources = Array.isArray(meta.source) ? meta.source : [meta.source];
  const mock = sources.includes("mock");
  return (
    <span
      title={meta.note ?? `Source: ${sources.map((s) => LABELS[s] ?? s).join(" + ")}${meta.stale ? " (cached)" : ""}`}
      className={cn(
        "hidden shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide sm:inline-block",
        mock ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-line text-muted",
        className,
      )}
    >
      {mock ? "Demo data" : sources.map((s) => LABELS[s] ?? s).join(" · ")}
    </span>
  );
}
