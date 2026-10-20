"use client";

import { cn } from "@/lib/format";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (T | { value: T; label: string })[];
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-lg border border-line bg-black/20 p-0.5", className)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const active = v === value;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              active ? "bg-white/10 text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
