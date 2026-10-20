"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import type { Quote, StockProfile } from "@/lib/types";
import { ApiError, useApi } from "@/lib/hooks";
import { usePrefs } from "@/lib/store";
import { Panel } from "@/components/ui/panel";
import { SourceBadge } from "@/components/ui/source-badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { NewsPanel } from "@/components/market/news-list";
import { AnalysisTab } from "./analysis-tab";
import { EarningsTab, FinancialsTab } from "./financials-tab";
import { OptionsTab } from "./options-tab";
import { OverviewTab } from "./overview-tab";
import { PriceChart } from "./price-chart";
import { StockHeader } from "./stock-header";

type Tab = "overview" | "analysis" | "financials" | "earnings" | "news" | "options";
const TABS: { id: Tab; label: string; equityOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "AI Analysis" },
  { id: "financials", label: "Financials", equityOnly: true },
  { id: "earnings", label: "Earnings", equityOnly: true },
  { id: "news", label: "News" },
  { id: "options", label: "Options", equityOnly: true },
];

export function StockView({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = decodeURIComponent(use(params).symbol).toUpperCase();
  const [tab, setTab] = useState<Tab>("overview");
  const pushRecent = usePrefs((s) => s.pushRecent);

  const profileQ = useApi<StockProfile>(`/api/stock/${encodeURIComponent(symbol)}`, { staleTime: 60_000 });
  const quoteQ = useApi<Quote[]>(`/api/quotes?symbols=${encodeURIComponent(symbol)}`, { refetchInterval: 15_000, staleTime: 5_000 });
  const profile = profileQ.data?.data;
  const quote = quoteQ.data?.data[0] ?? profile?.quote;
  const isEquity = !quote?.quoteType || quote.quoteType === "EQUITY" || quote.quoteType === "ETF";
  const hasFundamentals = quote?.quoteType === "EQUITY";

  useEffect(() => {
    if (profile) pushRecent(symbol);
  }, [profile, symbol, pushRecent]);

  useEffect(() => {
    if (quote?.price != null) document.title = `${symbol} ${quote.price.toFixed(2)} · Stock Analyses`;
  }, [symbol, quote?.price]);

  if (profileQ.error instanceof ApiError && profileQ.error.status === 404) {
    return (
      <Panel>
        <EmptyState title={`No market data for “${symbol}”`} hint="Check the ticker; non-US listings need an exchange suffix (e.g. SAN.MC, ASML.AS, 7203.T)." icon={<SearchX className="size-6" />}>
          <Link href="/" className="btn-ghost mt-2 text-xs">
            Back to overview
          </Link>
        </EmptyState>
      </Panel>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.equityOnly || (t.id === "options" ? isEquity : hasFundamentals));

  return (
    <div className="space-y-4">
      {profileQ.isLoading && !quote ? <HeaderSkeleton /> : <StockHeader symbol={symbol} quote={quote} profile={profile} />}
      {profileQ.data?.meta.source === "mock" && <SourceBadge meta={profileQ.data.meta} />}

      <Panel>
        <PriceChart symbol={symbol} currency={quote?.currency} />
      </Panel>

      <div className="flex gap-1 overflow-x-auto border-b border-line scrollbar-none">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-3 py-2 text-sm font-medium transition ${tab === t.id ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            {t.label}
            {t.id === "analysis" && <span className="ml-1.5 rounded bg-accent/15 px-1 text-[10px] text-accent">new</span>}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {profileQ.error && profileQ.error.message && tab !== "news" && tab !== "analysis" ? (
        <Panel>
          <ErrorState message={profileQ.error.message} onRetry={() => profileQ.refetch()} />
        </Panel>
      ) : (
        <TabBody tab={tab} symbol={symbol} profile={profile} quote={quote} />
      )}
    </div>
  );
}

function TabBody({ tab, symbol, profile, quote }: { tab: Tab; symbol: string; profile?: StockProfile; quote?: Quote }) {
  switch (tab) {
    case "overview":
      return profile ? <OverviewTab p={profile} /> : <Skeleton className="h-80" />;
    case "analysis":
      return <AnalysisTab symbol={symbol} price={quote?.price ?? null} currency={quote?.currency} />;
    case "financials":
      return <FinancialsTab symbol={symbol} currency={quote?.currency} />;
    case "earnings":
      return profile ? <EarningsTab p={profile} /> : <Skeleton className="h-80" />;
    case "news":
      return <NewsPanel url={`/api/stock/${encodeURIComponent(symbol)}/news`} title={`${symbol} news`} limit={25} />;
    case "options":
      return <OptionsTab symbol={symbol} />;
    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-10 w-56" />
    </div>
  );
}
