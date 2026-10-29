"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  History,
  RotateCcw,
} from "lucide-react";
import type { AgentVersion } from "@/server/agents/repository";

export interface RollbackModalProps {
  agentId: string;
  agentName: string;
  currentVersion: number;
  versions: AgentVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollback: (targetVersion: number, reason: string) => Promise<void> | void;
  isRollingBack?: boolean;
}

export function RollbackModal({
  agentName,
  currentVersion,
  versions,
  open,
  onOpenChange,
  onRollback,
  isRollingBack = false,
}: RollbackModalProps) {
  // Filter historical versions strictly earlier than current version
  const eligibleVersions = React.useMemo(() => {
    return versions
      .filter((v) => v.version < currentVersion)
      .sort((a, b) => b.version - a.version);
  }, [versions, currentVersion]);

  const [selectedVersion, setSelectedVersion] = React.useState<number>(
    eligibleVersions[0]?.version || 1
  );
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (eligibleVersions[0]) {
      setSelectedVersion(eligibleVersions[0].version);
    }
  }, [eligibleVersions]);

  const chosenVersionRecord = eligibleVersions.find((v) => v.version === selectedVersion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Rollback Configuration — ${agentName}`}
        description={`Safely restore an earlier verified configuration (Current: v${currentVersion})`}
        className="max-h-[90vh] max-w-xl overflow-y-auto"
      >
        <div className="space-y-4 pt-2 text-xs">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft p-3 text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Safe Restoration Policy</p>
              <p className="mt-0.5 text-muted leading-relaxed">
                Restoring a previous version does not overwrite history. The target configuration
                will be appended as a new immutable version (<strong>v{currentVersion + 1}</strong>)
                with source tagged as <code>rollback</code> and synchronized to ElevenLabs.
              </p>
            </div>
          </div>

          {eligibleVersions.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-muted">
              No earlier configuration versions available to restore for this agent.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Select Target Version to Restore:
                </label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                  className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {eligibleVersions.map((v) => (
                    <option key={v.version} value={v.version}>
                      Version {v.version} — {v.summary} ({new Date(v.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {chosenVersionRecord && (
                <div className="rounded-md border bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-accent" />
                      Target Version {chosenVersionRecord.version} Details
                    </span>
                    <Badge tone="neutral" className="text-[10px]">
                      Source: {chosenVersionRecord.source}
                    </Badge>
                  </div>
                  <p className="text-muted leading-relaxed">
                    <strong>Summary:</strong> {chosenVersionRecord.summary}
                  </p>
                  <p className="text-[11px] text-muted">
                    Created: {new Date(chosenVersionRecord.createdAt).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Reason for Rollback (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Degraded customer satisfaction on v2 instructions"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            <Button
              variant="danger"
              disabled={eligibleVersions.length === 0 || isRollingBack}
              onClick={() => onRollback(selectedVersion, reason)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {isRollingBack ? "Restoring..." : `Restore to Version ${selectedVersion}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
