"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/format";
import { NAV } from "./nav";
import { MiniWatchlist } from "./mini-watchlist";

const isActive = (href: string, pathname: string | null) => pathname != null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Pathname is request-time data, so the active-state nav streams in under Suspense with an inactive fallback. */
function WithPathname({ render }: { render: (pathname: string | null) => ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <PathnameReader render={render} />
    </Suspense>
  );
}

function PathnameReader({ render }: { render: (pathname: string | null) => ReactNode }) {
  return render(usePathname());
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-black/20 backdrop-blur lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-slate-950 shadow-lg shadow-sky-500/20">
          <Activity className="size-4.5" strokeWidth={2.5} />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Stock Analyses</span>
          <span className="block text-[11px] text-muted">Global market terminal</span>
        </span>
      </Link>
      <WithPathname
        render={(pathname) => (
          <nav className="space-y-0.5 px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-accent")} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      />
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <MiniWatchlist />
      </div>
    </aside>
  );
}

export function MobileNav() {
  return <WithPathname render={(pathname) => <MobileNavItems pathname={pathname} />} />;
}

function MobileNavItems({ pathname }: { pathname: string | null }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {NAV.filter((n) => n.href !== "/settings").map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", active ? "text-accent" : "text-muted")}>
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
