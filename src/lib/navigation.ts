import { Bot, BarChart3, FlaskConical, FolderKanban, LayoutDashboard, Rocket, Settings, Users, Wrench, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Undefined = implemented now. Otherwise the roadmap phase that delivers it. */
  plannedPhase?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/virtual-customers", label: "Virtual Customers", icon: Users },
  { href: "/test-lab", label: "Test Lab", icon: FlaskConical },
  { href: "/results", label: "Results", icon: BarChart3, plannedPhase: 5 },
  { href: "/refinement", label: "Refinement", icon: Wrench, plannedPhase: 6 },
  { href: "/deployments", label: "Deployments", icon: Rocket, plannedPhase: 7 },
  { href: "/settings", label: "Settings", icon: Settings },
];
