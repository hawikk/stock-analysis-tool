import type { ReactNode } from "react";
import type { Meta } from "@/lib/types";
import { cn } from "@/lib/format";
import { SourceBadge } from "./source-badge";

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  meta,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  meta?: Meta;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("panel flex min-w-0 flex-col overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="text-accent">{icon}</span>}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-fg">{title}</h2>
              {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
            </div>
            {meta && <SourceBadge meta={meta} />}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
