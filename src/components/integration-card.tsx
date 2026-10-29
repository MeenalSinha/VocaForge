"use client";

import { RefreshCw } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { IntegrationStatusBadge } from "@/components/ui/status";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { IntegrationStatus } from "@/server/integrations/elevenlabs";

export function ElevenLabsStatusPanel({ initial }: { initial: IntegrationStatus }) {
  const [status, setStatus] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function check() {
    setBusy(true);
    setFailure(null);
    try {
      setStatus(await api<IntegrationStatus>("/api/integrations/elevenlabs/check", { method: "POST" }));
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : "The check could not be run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">ElevenLabs Agents API</span>
          <IntegrationStatusBadge state={status.state} />
        </div>
        <Button variant="secondary" size="sm" onClick={check} loading={busy} disabled={status.state === "not_configured"}>
          {!busy && <RefreshCw className="h-4 w-4" aria-hidden />}
          Run connection check
        </Button>
      </div>
      <div aria-live="polite" className="text-sm text-muted">
        <p>{failure ?? status.message}</p>
        {status.checkedAt && <p className="mt-1 text-xs">Last checked {formatDateTime(status.checkedAt)} against {status.baseUrl}</p>}
      </div>
    </div>
  );
}
