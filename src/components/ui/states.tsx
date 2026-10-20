import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-4", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-6 text-center", className)}>
      <AlertTriangle className="size-5 text-amber-400" />
      <p className="text-sm text-fg">Couldn&apos;t load this data</p>
      {message && <p className="max-w-sm text-xs text-muted">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-1 text-xs">
          <RotateCw className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, icon, className, children }: { title: string; hint?: string; icon?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-8 text-center", className)}>
      <div className="text-muted">{icon ?? <Inbox className="size-6" />}</div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}
