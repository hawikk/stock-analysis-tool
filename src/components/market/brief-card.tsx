"use client";

import { Sparkles } from "lucide-react";
import type { MarketBrief } from "@/lib/types";
import { useApi } from "@/lib/hooks";
import { cn, fmtRelative } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { RichText } from "@/components/ui/rich-text";
import { ErrorState, Skeleton } from "@/components/ui/states";

export function BriefCard() {
  const { data, isLoading, error, refetch } = useApi<MarketBrief>("/api/brief", { refetchInterval: 120_000 });
  const b = data?.data;
  return (
    <Panel
      title="Market brief"
      icon={<Sparkles className="size-4" />}
      subtitle={b ? `${b.engine === "ai" ? `AI · ${b.model}` : "Rules-based snapshot · add an AI key for narrative"} · ${fmtRelative(b.generatedAt)}` : "Cross-asset summary"}
      className="h-full"
    >
      {isLoading && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {b && (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-snug tracking-tight">{b.headline}</h3>
            <p className="mt-1.5 text-sm text-muted">
              <RichText text={b.summary} />
            </p>
            <ul className="mt-3 space-y-1.5">
              {b.bullets.map((x, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                  <span>
                    <RichText text={x} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <MoodGauge score={b.moodScore} mood={b.mood} />
        </div>
      )}
    </Panel>
  );
}

function MoodGauge({ score, mood }: { score: number; mood: MarketBrief["mood"] }) {
  const angle = -90 + (score / 100) * 180;
  const r = 52;
  const arc = (from: number, to: number) => {
    const p = (a: number) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return `${60 + r * Math.cos(rad)},${64 + r * Math.sin(rad)}`;
    };
    return `M${p(from)} A${r},${r} 0 0 1 ${p(to)}`;
  };
  return (
    <div className="flex flex-col items-center justify-center md:w-40">
      <svg width={120} height={76} viewBox="0 0 120 76">
        <path d={arc(-90, -30)} stroke="var(--color-down)" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />
        <path d={arc(-28, 28)} stroke="var(--color-warn)" strokeWidth={9} fill="none" opacity={0.85} />
        <path d={arc(30, 90)} stroke="var(--color-up)" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />
        <g transform={`rotate(${angle} 60 64)`}>
          <line x1={60} y1={64} x2={60} y2={20} stroke="var(--color-fg)" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <circle cx={60} cy={64} r={5} fill="var(--color-fg)" />
      </svg>
      <div className="num text-2xl font-semibold">{score}</div>
      <div className={cn("text-xs font-medium", mood === "Risk-on" ? "text-up" : mood === "Risk-off" ? "text-down" : "text-warn")}>{mood}</div>
    </div>
  );
}
