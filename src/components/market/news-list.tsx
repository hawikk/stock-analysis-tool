"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Newspaper } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { useApi, useMounted } from "@/lib/hooks";
import { fmtRelative } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";

type Topic = "markets" | "global" | "macro";

export function NewsFeed({ className, limit = 12, title = "Headlines" }: { className?: string; limit?: number; title?: string }) {
  const [topic, setTopic] = useState<Topic>("markets");
  return (
    <NewsPanel
      url={`/api/news?topic=${topic}`}
      title={title}
      className={className}
      limit={limit}
      actions={
        <Segmented
          value={topic}
          onChange={setTopic}
          size="xs"
          options={[
            { value: "markets", label: "Markets" },
            { value: "global", label: "Global" },
            { value: "macro", label: "Macro" },
          ]}
        />
      }
    />
  );
}

export function NewsPanel({
  url,
  title,
  className,
  limit = 12,
  actions,
  thumbnails = true,
}: {
  url: string;
  title: string;
  className?: string;
  limit?: number;
  actions?: ReactNode;
  thumbnails?: boolean;
}) {
  const { data, isLoading, error, refetch } = useApi<NewsItem[]>(url, { refetchInterval: 300_000 });
  const items = (data?.data ?? []).slice(0, limit);
  return (
    <Panel title={title} icon={<Newspaper className="size-4" />} meta={data?.meta} className={className} actions={actions}>
      {isLoading && <SkeletonRows rows={6} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && items.length === 0 && <EmptyState title="No recent headlines" />}
      <NewsItems items={items} thumbnails={thumbnails} />
    </Panel>
  );
}

export function NewsItems({ items, thumbnails = true }: { items: NewsItem[]; thumbnails?: boolean }) {
  const mounted = useMounted();
  return (
    <ul className="divide-y divide-line/60">
      {items.map((n) => (
        <li key={n.id} className="flex gap-3 px-4 py-2.5 hover:bg-white/[0.03]">
          {thumbnails && (
            <a href={n.url} target="_blank" rel="noreferrer" tabIndex={-1} className="relative hidden size-14 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:block">
              {n.thumbnail && <Image src={n.thumbnail} alt="" fill sizes="56px" unoptimized className="object-cover" />}
            </a>
          )}
          <div className="min-w-0 flex-1">
            <a href={n.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm leading-snug text-fg hover:text-accent">
              {n.title}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              <span>{n.publisher}</span>
              <span>· {mounted ? fmtRelative(n.publishedAt) : ""}</span>
              {n.tickers?.slice(0, 4).map((t) => (
                <TickerChip key={t} symbol={t} />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TickerChip({ symbol }: { symbol: string }) {
  return (
    <Link href={`/stock/${encodeURIComponent(symbol)}`} className="rounded bg-accent/10 px-1.5 py-px font-medium text-accent hover:bg-accent/20">
      {symbol}
    </Link>
  );
}
