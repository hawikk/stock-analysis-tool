import { CalendarDays, Globe2, LayoutDashboard, Landmark, LayoutGrid, Settings, Star } from "lucide-react";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/markets", label: "World", icon: Globe2 },
  { href: "/heatmap", label: "Heatmap", icon: LayoutGrid },
  { href: "/macro", label: "Macro", icon: Landmark },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
