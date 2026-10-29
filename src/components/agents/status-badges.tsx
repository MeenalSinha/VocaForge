import { Badge } from "@/components/ui/badge";
import type { Agent } from "@/server/agents/repository";

export function AgentStatusBadge({ status }: { status: Agent["status"] }) {
  const m = { active: ["success", "Active"], remote_missing: ["danger", "Missing in ElevenLabs"], remote_deleted: ["neutral", "Deleted from ElevenLabs"], archived: ["neutral", "Archived"] } as const;
  const [tone, label] = m[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SyncBadge({ agent }: { agent: Pick<Agent, "configVersion" | "syncedVersion"> }) {
  if (agent.syncedVersion === agent.configVersion) return <Badge tone="success">Version {agent.configVersion} sent to ElevenLabs</Badge>;
  return <Badge tone="warning">Version {agent.configVersion} saved, not sent to ElevenLabs</Badge>;
}
