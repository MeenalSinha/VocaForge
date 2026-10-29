import type { IntegrationState } from "@/server/integrations/elevenlabs";
import { Badge } from "./badge";

const MAP: Record<IntegrationState, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  not_configured: { label: "Not configured", tone: "neutral" },
  unverified: { label: "Not verified", tone: "warning" },
  connected: { label: "Connected", tone: "success" },
  auth_failed: { label: "Authentication failed", tone: "danger" },
  permission_denied: { label: "Permission denied", tone: "danger" },
  rate_limited: { label: "Rate limited", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
  error: { label: "Check failed", tone: "danger" },
};

export function IntegrationStatusBadge({ state }: { state: IntegrationState }) {
  const { label, tone } = MAP[state];
  return <Badge tone={tone}>{label}</Badge>;
}

export const integrationStateLabel = (s: IntegrationState) => MAP[s].label;
