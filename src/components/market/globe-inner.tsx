"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import type { PerfWindow, WorldIndexRow } from "@/lib/types";
import { changeColor, fmtPct, fmtPrice } from "@/lib/format";

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string };

const topo = worldTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const COUNTRIES = (feature(topo, topo.objects.countries) as unknown as { features: CountryFeature[] }).features.filter((f) => f.properties.name !== "Antarctica");

export const WINDOW_SCALE: Record<PerfWindow, number> = { "1D": 2, "1W": 4, "1M": 7, "3M": 12, YTD: 25, "1Y": 30 };

export type GlobeInnerProps = {
  width: number;
  height: number;
  rows: WorldIndexRow[];
  window: PerfWindow;
  openExchanges: { lat: number; lng: number; id: string }[];
  onSelect?: (row: WorldIndexRow) => void;
  autoRotate?: boolean;
};

export default function GlobeInner({ width, height, rows, window, openExchanges, onSelect, autoRotate = true }: GlobeInnerProps) {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const [hover, setHover] = useState<string | null>(null);

  const byIso = useMemo(() => {
    const m = new Map<string, WorldIndexRow>();
    for (const r of rows) if (r.primary && r.iso) m.set(r.iso, r);
    return m;
  }, [rows]);

  const points = useMemo(() => rows.filter((r) => r.primary), [rows]);
  const scale = WINDOW_SCALE[window];
  const value = (r: WorldIndexRow | undefined) => (r ? ((window === "1D" ? r.changePercent : r.perf?.[window]) ?? null) : null);

  const material = useMemo(() => new MeshPhongMaterial({ color: "#0a1424", emissive: "#060c18", shininess: 12, transparent: true, opacity: 0.96 }), []);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const c = g.controls();
    c.autoRotate = autoRotate && !hover;
    c.autoRotateSpeed = 0.45;
    c.enableZoom = true;
  }, [autoRotate, hover]);

  useEffect(() => {
    ref.current?.pointOfView({ lat: 30, lng: 10, altitude: 2.2 }, 0);
  }, []);

  return (
    <Globe
      ref={ref}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={material}
      showAtmosphere
      atmosphereColor="#38bdf8"
      atmosphereAltitude={0.18}
      polygonsData={COUNTRIES}
      polygonAltitude={(d) => ((d as CountryFeature).id === hover ? 0.03 : byIso.has(String((d as CountryFeature).id)) ? 0.012 : 0.006)}
      polygonCapColor={(d) => {
        const r = byIso.get(String((d as CountryFeature).id));
        return r ? changeColor(value(r), scale, (d as CountryFeature).id === hover ? 1 : 0.9) : "rgba(30,41,59,0.55)";
      }}
      polygonSideColor={() => "rgba(15,23,42,0.6)"}
      polygonStrokeColor={() => "rgba(148,163,184,0.25)"}
      polygonLabel={(d) => {
        const f = d as CountryFeature;
        const r = byIso.get(String(f.id));
        if (!r) return `<div class="globe-tip"><b>${f.properties.name}</b><br/><span style="opacity:.6">No tracked index</span></div>`;
        const v = value(r);
        const color = v === null ? "#94a3b8" : v >= 0 ? "#22c55e" : "#f43f5e";
        return `<div class="globe-tip"><div>${r.flag} <b>${r.country}</b></div><div style="opacity:.75">${r.label}</div><div style="font-family:var(--font-mono)">${fmtPrice(r.price)} <span style="color:${color}">${fmtPct(v)}</span> <span style="opacity:.6">${window}</span></div></div>`;
      }}
      onPolygonHover={(d) => setHover(d ? String((d as CountryFeature).id) : null)}
      onPolygonClick={(d) => {
        const r = byIso.get(String((d as CountryFeature).id));
        if (r) onSelect?.(r);
      }}
      polygonsTransitionDuration={300}
      pointsData={points}
      pointLat={(d) => (d as WorldIndexRow).lat}
      pointLng={(d) => (d as WorldIndexRow).lng}
      pointColor={(d) => changeColor(value(d as WorldIndexRow), scale)}
      pointAltitude={(d) => Math.min(0.35, Math.abs(value(d as WorldIndexRow) ?? 0) / scale / 4 + 0.01)}
      pointRadius={0.45}
      pointsMerge={false}
      onPointClick={(d) => onSelect?.(d as WorldIndexRow)}
      pointLabel={(d) => {
        const r = d as WorldIndexRow;
        return `<div class="globe-tip">${r.flag} <b>${r.label}</b><br/><span style="font-family:var(--font-mono)">${fmtPct(value(r))}</span></div>`;
      }}
      ringsData={openExchanges}
      ringLat={(d) => (d as { lat: number }).lat}
      ringLng={(d) => (d as { lng: number }).lng}
      ringColor={() => (t: number) => `rgba(56,189,248,${1 - t})`}
      ringMaxRadius={4}
      ringPropagationSpeed={2}
      ringRepeatPeriod={1400}
    />
  );
}
