"use client";

import { Wand2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import type { AgentConfig } from "@/server/agents/config-schema";
import type { RefineResult } from "@/server/generation/service";

/** Plain-language refinement. Nothing changes until the user accepts a validated proposal. */
export function RefinePanel({ config, onApply, disabled }: { config: AgentConfig; onApply: (proposed: AgentConfig, summary: string) => void; disabled?: boolean }) {
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<(RefineResult & { instruction: string }) | null>(null);

  async function propose() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<RefineResult>("/api/agents/refine", { method: "POST", json: { config, instruction } });
      setResult({ ...r, instruction });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The change could not be proposed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Refine with plain language</CardTitle><Wand2 className="h-4 w-4 text-muted" aria-hidden /></CardHeader>
      <CardBody className="space-y-4">
        <Field id="refine-instruction" label="What should change?" hint="For example: make the welcome message shorter, or use a friendlier tone." error={undefined}>
          {(a) => <Textarea {...a} rows={2} maxLength={1000} value={instruction} onChange={(e) => setInstruction(e.target.value)} disabled={disabled} />}
        </Field>
        <Button onClick={propose} loading={busy} disabled={disabled || !instruction.trim()}>Propose changes</Button>
        {error && <Alert tone="danger" title="Could not propose changes">{error}</Alert>}
        {result && (
          <div className="space-y-3" aria-live="polite">
            {result.changes.length === 0 ? (
              <Alert title="No changes proposed">The model did not find anything to change for this request.</Alert>
            ) : (
              <>
                <p className="text-sm font-medium">Proposed changes (not applied yet)</p>
                <ul className="space-y-2">
                  {result.changes.map((c) => (
                    <li key={c.path} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{c.label}</p>
                      <p className="text-muted"><span className="font-medium text-foreground">Before:</span> {c.before}</p>
                      <p className="text-muted"><span className="font-medium text-foreground">After:</span> {c.after}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.openQuestions.length > 0 && <Alert tone="warning" title="The model needs more information">{result.openQuestions.join(" ")}</Alert>}
            <div className="flex gap-2">
              {result.changes.length > 0 && <Button onClick={() => { onApply(result.proposed, `Refinement: ${result.instruction.slice(0, 200)}`); setResult(null); setInstruction(""); }}>Apply to editor</Button>}
              <Button variant="secondary" onClick={() => setResult(null)}>{result.changes.length > 0 ? "Reject" : "Dismiss"}</Button>
            </div>
            {result.changes.length > 0 && <p className="text-xs text-muted">Applying only updates the editor. Save to keep the change, then send it to ElevenLabs.</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
