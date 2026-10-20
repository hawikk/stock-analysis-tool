import { cn, fmtPct } from "@/lib/format";

export function Change({ value, className, digits = 2, pill = false }: { value: number | null | undefined; className?: string; digits?: number; pill?: boolean }) {
  const up = (value ?? 0) > 0;
  const down = (value ?? 0) < 0;
  return (
    <span
      className={cn(
        "num whitespace-nowrap",
        up && "text-up",
        down && "text-down",
        !up && !down && "text-muted",
        pill && "rounded-md px-1.5 py-0.5 text-xs font-medium",
        pill && up && "bg-up/12",
        pill && down && "bg-down/12",
        pill && !up && !down && "bg-white/5",
        className,
      )}
    >
      {fmtPct(value, digits)}
    </span>
  );
}
