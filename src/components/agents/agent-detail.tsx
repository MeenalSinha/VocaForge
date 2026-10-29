"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { agentConfigSchema, fieldErrorsOf, type AgentConfig } from "@/server/agents/config-schema";
import { sameConfig } from "@/server/agents/diff";
import type { Agent, AgentVersion } from "@/server/agents/repository";
import { ConfigEditor, type ConfigErrors } from "./config-editor";
import { RefinePanel } from "./refine-panel";
import { AgentStatusBadge, SyncBadge } from "./status-badges";

export function AgentDetail({ initialAgent, initialVersions }: { initialAgent: Agent; initialVersions: AgentVersion[] }) {
  const router = useRouter();
  const [agent, setAgent] = React.useState(initialAgent);
  const [versions, setVersions] = React.useState(initialVersions);
  const [draft, setDraft] = React.useState<AgentConfig>(initialAgent.config);
  const [errors, setErrors] = React.useState<ConfigErrors>({});
  const [busy, setBusy] = React.useState<null | "save" | "sync" | "refresh" | "archive" | "delete">(null);
  const [message, setMessage] = React.useState<{ tone: "danger" | "success" | "info"; text: string } | null>(null);
  const [refineSummary, setRefineSummary] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<null | "archive" | "delete">(null);
  const [confirmName, setConfirmName] = React.useState("");

  const dirty = !sameConfig(draft, agent.config);
  const locked = agent.status === "archived" || agent.status === "remote_deleted";

  async function reload() {
    const r = await api<{ agent: Agent; versions: AgentVersion[] }>(`/api/agents/${agent.id}`);
    setAgent(r.agent);
    setVersions(r.versions);
    return r.agent;
  }
  const fail = (err: unknown, fallback: string) => setMessage({ tone: "danger", text: err instanceof ApiError ? err.message : fallback });

  async function save() {
    const check = agentConfigSchema.safeParse(draft);
    if (!check.success) { setErrors(fieldErrorsOf(check.error)); toast.error("Please fix the highlighted fields."); return; }
    setBusy("save"); setMessage(null); setErrors({});
    try {
      const r = await api<{ agent: Agent; changed: boolean }>(`/api/agents/${agent.id}`, { method: "PATCH", json: { config: check.data, baseVersion: agent.configVersion, source: refineSummary ? "refinement" : "manual_edit", summary: refineSummary ?? undefined } });
      setRefineSummary(null);
      await reload();
      toast.success(r.changed ? `Saved as version ${r.agent.configVersion}` : "Nothing to save");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      fail(err, "The changes could not be saved.");
    } finally { setBusy(null); }
  }

  async function action(kind: "sync" | "refresh") {
    setBusy(kind); setMessage(null);
    try {
      if (kind === "sync") {
        await api(`/api/agents/${agent.id}/sync`, { method: "POST" });
        await reload();
        setMessage({ tone: "success", text: "ElevenLabs accepted the update." });
      } else {
        const r = await api<{ remote: { found: boolean; matchesLocal: boolean | null; differences: string[] } }>(`/api/agents/${agent.id}/refresh`, { method: "POST" });
        await reload();
        setMessage({ tone: r.remote.found && r.remote.matchesLocal ? "success" : "info", text: !r.remote.found ? "ElevenLabs could not find this agent." : r.remote.matchesLocal ? "The remote agent matches the saved configuration." : `The remote agent differs from the saved configuration: ${r.remote.differences.join(", ")}.` });
      }
    } catch (err) {
      fail(err, "The request failed.");
      await reload().catch(() => undefined);
    } finally { setBusy(null); }
  }

  async function lifecycle() {
    const kind = confirm;
    if (!kind) return;
    setBusy(kind === "archive" ? "archive" : "delete"); setMessage(null);
    try {
      if (kind === "archive") await api(`/api/agents/${agent.id}/archive`, { method: "POST" });
      else await api(`/api/agents/${agent.id}/delete-remote`, { method: "POST", json: { confirmName } });
      setConfirm(null); setConfirmName("");
      await reload();
      toast.success(kind === "archive" ? "Agent archived. The ElevenLabs agent was not deleted." : "Agent deleted from ElevenLabs");
      router.refresh();
    } catch (err) { fail(err, "The action failed."); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <AgentStatusBadge status={agent.status} />
        <SyncBadge agent={agent} />
        {dirty && <Badge tone="warning">Unsaved changes</Badge>}
        {agent.remoteStatusNote && <span className="text-xs text-muted">{agent.remoteStatusNote}</span>}
      </div>
      {message && <Alert tone={message.tone} title={message.tone === "danger" ? "That did not work" : "Done"}>{message.text}</Alert>}

      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <Button onClick={save} loading={busy === "save"} disabled={!dirty || locked}>Save changes</Button>
          <Button variant="secondary" onClick={() => { setDraft(agent.config); setErrors({}); setRefineSummary(null); }} disabled={!dirty}>Discard changes</Button>
          <Button variant="secondary" onClick={() => action("sync")} loading={busy === "sync"} disabled={dirty || locked} title={dirty ? "Save your changes first" : undefined}>Send to ElevenLabs</Button>
          <Button variant="secondary" onClick={() => action("refresh")} loading={busy === "refresh"}>Refresh remote status</Button>
          <Button asChild variant="secondary" aria-disabled={agent.status !== "active"}><Link href={`/agents/${agent.id}/test`}>Talk to this agent</Link></Button>
          <Button variant="ghost" onClick={() => setConfirm("archive")} disabled={locked}>Archive</Button>
          <Button variant="danger" onClick={() => setConfirm("delete")} disabled={agent.status === "remote_deleted"}>Delete from ElevenLabs</Button>
        </CardBody>
      </Card>

      <RefinePanel config={draft} disabled={locked} onApply={(p, s) => { setDraft(p); setRefineSummary(s); setErrors({}); toast.success("Applied to the editor. Save to keep it."); }} />
      <ConfigEditor value={draft} onChange={setDraft} errors={errors} disabled={locked} />

      <Card>
        <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
        <CardBody>
          <ul className="divide-y">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div><p className="font-medium">Version {v.version} <span className="text-xs font-normal text-muted">({v.source.replace("_", " ")})</span></p><p className="text-sm text-muted">{v.summary}</p>{v.syncError && <p className="text-xs text-danger">Last send failed: {v.syncError}</p>}</div>
                <div className="text-right text-xs text-muted"><Badge tone={v.syncStatus === "synced" ? "success" : v.syncStatus === "failed" ? "danger" : "neutral"}>{v.syncStatus === "synced" ? "Sent" : v.syncStatus === "failed" ? "Send failed" : "Not sent"}</Badge><p className="mt-1"><time dateTime={v.createdAt}>{formatDateTime(v.createdAt)}</time></p></div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <ConfirmDialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)} title={`Archive "${agent.name}"?`} description="The agent is hidden from the library and can no longer be edited here. The agent in ElevenLabs is not deleted." confirmLabel="Archive agent" onConfirm={lifecycle} loading={busy === "archive"} destructive />
      <Dialog open={confirm === "delete"} onOpenChange={(o) => { if (!o) { setConfirm(null); setConfirmName(""); } }}>
        <DialogContent title="Delete from ElevenLabs" description="This permanently deletes the agent in your ElevenLabs account. VocaForge only reports success after ElevenLabs confirms the agent is gone.">
          <div className="space-y-4">
            <Field id="confirm-name" label={`Type "${agent.name}" to confirm`} error={undefined}>{(a) => <Input {...a} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={lifecycle} loading={busy === "delete"} disabled={confirmName.trim() !== agent.name}>Delete permanently</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
