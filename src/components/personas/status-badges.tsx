"use client";

import { Badge } from "@/components/ui/badge";
import type { PersonaCategory, PersonaStatus, ScenarioPriority, ScenarioStatus } from "@/server/personas/schema";

export function PersonaStatusBadge({ status }: { status: PersonaStatus }) {
  switch (status) {
    case "ready_for_testing":
      return <Badge tone="success">Ready for Testing</Badge>;
    case "needs_configuration":
      return <Badge tone="warning">Needs Configuration</Badge>;
    case "archived":
      return <Badge tone="neutral">Archived</Badge>;
    case "draft":
    default:
      return <Badge tone="neutral">Draft</Badge>;
  }
}

export function ScenarioStatusBadge({ status }: { status: ScenarioStatus }) {
  switch (status) {
    case "ready_for_testing":
      return <Badge tone="success">Ready for Testing</Badge>;
    case "needs_configuration":
      return <Badge tone="warning">Needs Configuration</Badge>;
    case "archived":
      return <Badge tone="neutral">Archived</Badge>;
    case "draft":
    default:
      return <Badge tone="neutral">Draft</Badge>;
  }
}

export function CategoryBadge({ category }: { category: PersonaCategory }) {
  const map: Record<PersonaCategory, { label: string; tone: "neutral" | "accent" | "warning" | "success" | "danger" }> = {
    customer_experience: { label: "Customer Experience", tone: "accent" },
    pricing_policies: { label: "Pricing & Policies", tone: "warning" },
    communication: { label: "Communication", tone: "neutral" },
    support: { label: "Support", tone: "danger" },
    custom: { label: "Custom", tone: "neutral" },
  };
  const c = map[category] || { label: category, tone: "neutral" };
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function ScenarioPriorityBadge({ priority }: { priority: ScenarioPriority }) {
  switch (priority) {
    case "critical":
      return <Badge tone="danger">Critical</Badge>;
    case "high":
      return <Badge tone="warning">High Priority</Badge>;
    case "medium":
      return <Badge tone="neutral">Medium Priority</Badge>;
    case "low":
    default:
      return <Badge tone="neutral">Low Priority</Badge>;
  }
}
