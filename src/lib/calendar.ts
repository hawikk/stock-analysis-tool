import type { EarningsTiming, EconomicImpact } from "@/lib/types";
import { fmtTime } from "@/lib/format";

export function timingLabel(t: EarningsTiming): string {
  switch (t) {
    case "bmo":
      return "Before open";
    case "amc":
      return "After close";
    case "dmh":
      return "During hours";
    case "unknown":
      return "Time TBA";
    default: {
      const exhaustive: never = t;
      return exhaustive;
    }
  }
}

export function timingShort(t: EarningsTiming): string {
  switch (t) {
    case "bmo":
      return "BMO";
    case "amc":
      return "AMC";
    case "dmh":
      return "DMH";
    case "unknown":
      return "TBA";
    default: {
      const exhaustive: never = t;
      return exhaustive;
    }
  }
}

/** Local clock time for an earnings release; BMO/AMC are approximations of the US session edges. */
export function earningsLocalTime(approxTime: string, timing: EarningsTiming, tz: string): string | null {
  if (timing === "unknown") return null;
  return `${timing === "dmh" ? "" : "~"}${fmtTime(approxTime, tz)}`;
}

export const IMPACT_STYLE: Record<EconomicImpact, { dot: string; label: string; text: string }> = {
  high: { dot: "bg-down", label: "High", text: "text-down" },
  medium: { dot: "bg-warn", label: "Medium", text: "text-warn" },
  low: { dot: "bg-slate-500", label: "Low", text: "text-muted" },
};

export const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸",
  "Euro Zone": "🇪🇺",
  "Euro Area": "🇪🇺",
  Eurozone: "🇪🇺",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  "United Kingdom": "🇬🇧",
  Japan: "🇯🇵",
  China: "🇨🇳",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
  "New Zealand": "🇳🇿",
  Switzerland: "🇨🇭",
  India: "🇮🇳",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  "South Korea": "🇰🇷",
  "Hong Kong": "🇭🇰",
  Singapore: "🇸🇬",
  Sweden: "🇸🇪",
  Norway: "🇳🇴",
  Denmark: "🇩🇰",
  Netherlands: "🇳🇱",
  Belgium: "🇧🇪",
  Austria: "🇦🇹",
  Ireland: "🇮🇪",
  Portugal: "🇵🇹",
  Greece: "🇬🇷",
  Poland: "🇵🇱",
  Turkey: "🇹🇷",
  "South Africa": "🇿🇦",
  Russia: "🇷🇺",
  Indonesia: "🇮🇩",
  Taiwan: "🇹🇼",
  Thailand: "🇹🇭",
  Malaysia: "🇲🇾",
  Philippines: "🇵🇭",
  Israel: "🇮🇱",
  "Saudi Arabia": "🇸🇦",
  Chile: "🇨🇱",
  Colombia: "🇨🇴",
  Argentina: "🇦🇷",
  Finland: "🇫🇮",
  "Czech Republic": "🇨🇿",
  Hungary: "🇭🇺",
};

export function flagFor(country: string) {
  return COUNTRY_FLAGS[country] ?? "🌐";
}
