import { useId } from "react";

export function Sparkline({
  data,
  width = 96,
  height = 28,
  baseline,
  className,
  strokeWidth = 1.5,
}: {
  data?: number[];
  width?: number;
  height?: number;
  baseline?: number | null;
  className?: string;
  strokeWidth?: number;
}) {
  const id = useId();
  if (!data || data.length < 2) return <svg width={width} height={height} className={className} aria-hidden />;
  const min = Math.min(...data, baseline ?? Infinity);
  const max = Math.max(...data, baseline ?? -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const ref = baseline ?? data[0];
  const up = data[data.length - 1] >= ref;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  const path = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {baseline != null && <line x1={0} x2={width} y1={y(baseline)} y2={y(baseline)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="2 3" />}
      <path d={`${path}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
