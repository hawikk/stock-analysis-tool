"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { CommandSearch } from "./command-search";
import { TimezonePicker } from "./timezone-picker";
import { MarketStatusPill } from "./market-status-pill";

export function Topbar() {
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-slate-950 lg:hidden">
          <Activity className="size-4" strokeWidth={2.5} />
        </Link>
        <div className="min-w-0 flex-1">
          <CommandSearch />
        </div>
        <MarketStatusPill />
        <TimezonePicker />
      </div>
    </div>
  );
}
