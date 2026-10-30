"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { CodesField, LinesField } from "@/components/agents/lines-field";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { AgentConfig } from "@/server/agents/config-schema";
import type { PersonaRecord, ScenarioConfig, ScenarioPriority, ScenarioRecord } from "@/server/personas/schema";
import { emptyScenarioConfig } from "@/server/personas/schema";
import { evaluateScenarioReadiness } from "@/server/personas/readiness";
import { toast } from "sonner";

export interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  personas: PersonaRecord[];
  agents?: { id: string; name: string; config?: AgentConfig }[];
  initialScenario?: ScenarioRecord | null;
  preselectedPersonaId?: string;
  onSuccess: (scenario: ScenarioRecord) => void;
}

export function ScenarioDialog({
  open,
  onOpenChange,
  projectId,
  personas,
  agents = [],
  initialScenario,
  preselectedPersonaId,
  onSuccess,
}: ScenarioDialogProps) {
  const isEditing = Boolean(initialScenario);

  const [name, setName] = React.useState(initialScenario?.name || "");
  const [description, setDescription] = React.useState(initialScenario?.description || "");
  const [personaId, setPersonaId] = React.useState(
    initialScenario?.personaId || preselectedPersonaId || personas[0]?.id || "",
  );
  const [targetAgentId, setTargetAgentId] = React.useState<string>(initialScenario?.targetAgentId || "");
  const [priority, setPriority] = React.useState<ScenarioPriority>(initialScenario?.priority || "medium");
  const [config, setConfig] = React.useState<ScenarioConfig>(
    initialScenario?.config || emptyScenarioConfig(),
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    if (initialScenario) {
      setName(initialScenario.name);
      setDescription(initialScenario.description || "");
      setPersonaId(initialScenario.personaId);
      setTargetAgentId(initialScenario.targetAgentId || "");
      setPriority(initialScenario.priority);
      setConfig(initialScenario.config);
    } else {
      setName("");
      setDescription("");
      setPersonaId(preselectedPersonaId || personas[0]?.id || "");
      setTargetAgentId("");
      setPriority("medium");
      setConfig(emptyScenarioConfig());
    }
    setFieldErrors({});
  }, [initialScenario, preselectedPersonaId, personas, open]);

  const updateObjective = (patch: Partial<ScenarioConfig["objective"]>) => {
    setConfig((prev) => ({ ...prev, objective: { ...prev.objective, ...patch } }));
  };

  const updateEvaluation = (patch: Partial<ScenarioConfig["evaluation"]>) => {
    setConfig((prev) => ({ ...prev, evaluation: { ...prev.evaluation, ...patch } }));
  };

  const updateLimits = (patch: Partial<ScenarioConfig["executionLimits"]>) => {
    setConfig((prev) => ({ ...prev, executionLimits: { ...prev.executionLimits, ...patch } }));
  };

  const updateCompatibility = (patch: Partial<ScenarioConfig["compatibility"]>) => {
    setConfig((prev) => ({ ...prev, compatibility: { ...prev.compatibility, ...patch } }));
  };

  // Find target agent config if selected
  const selectedAgent = agents.find((a) => a.id === targetAgentId);
  const readiness = evaluateScenarioReadiness(
    name,
    config,
    isEditing ? initialScenario?.status : "draft",
    selectedAgent?.config,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: ["Scenario name is required."] });
      return;
    }
    if (!personaId) {
      setFieldErrors({ personaId: ["Select a virtual customer persona."] });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      if (isEditing && initialScenario) {
        const res = await fetch(`/api/scenarios/${initialScenario.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            personaId,
            targetAgentId: targetAgentId || null,
            priority,
            config,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.error?.fieldErrors) setFieldErrors(json.error.fieldErrors);
          throw new Error(json.error?.message || "Failed to update test scenario.");
        }
        toast.success(`Scenario "${name}" updated.`);
        onSuccess(json.data.scenario);
        onOpenChange(false);
      } else {
        const res = await fetch("/api/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            personaId,
            targetAgentId: targetAgentId || null,
            name,
            description,
            priority,
            config,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.error?.fieldErrors) setFieldErrors(json.error.fieldErrors);
          throw new Error(json.error?.message || "Failed to create test scenario.");
        }
        toast.success(`Scenario "${name}" created.`);
        onSuccess(json.data.scenario);
        onOpenChange(false);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? `Edit Test Scenario: ${initialScenario?.name}` : "Create Test Scenario"}
        description="Define the test mission, expected behavior, and concrete success/failure conditions."
        className="max-h-[92vh] max-w-3xl overflow-y-auto"
      >

        {/* Live Readiness Indicator */}
        <div
          className={`mt-1 rounded-lg border p-3 ${
            readiness.isReady
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {readiness.isReady ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            <span>
              {readiness.isReady
                ? "Scenario is well-defined and ready for future test runs."
                : "Missing required evaluation criteria."}
            </span>
          </div>
          {readiness.missing.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs opacity-90">
              {readiness.missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {readiness.warnings.length > 0 && (
            <div className="mt-2 border-t border-amber-500/20 pt-1.5 text-xs text-amber-700 dark:text-amber-300">
              <span className="font-semibold">Compatibility Warnings:</span>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {readiness.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="sc-name" label="Scenario Name" error={fieldErrors.name?.[0]}>
              {(attrs) => (
                <Input
                  {...attrs}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Urgent Appointment Booking Under Pressure"
                />
              )}
            </Field>

            <Field id="sc-priority" label="Priority">
              {(attrs) => (
                <select
                  {...attrs}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ScenarioPriority)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
              )}
            </Field>
          </div>

          <Field id="sc-description" label="Scenario Description">
            {(attrs) => (
              <Input
                {...attrs}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Validates whether the agent handles tight scheduling constraints without hallucinating availability."
              />
            )}
          </Field>

          {/* Targets */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="sc-persona" label="Associated Virtual Customer" error={fieldErrors.personaId?.[0]}>
              {(attrs) => (
                <select
                  {...attrs}
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    -- Choose a Virtual Customer --
                  </option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category.replace("_", " ")})
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field id="sc-target-agent" label="Target Agent (Optional)">
              {(attrs) => (
                <select
                  {...attrs}
                  value={targetAgentId}
                  onChange={(e) => setTargetAgentId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">-- Any Compatible Agent --</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {/* Objective & Situation */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Mission & Expected Outcome
            </span>
            <Field id="primary-goal" label="Primary Goal">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={config.objective.primaryGoal}
                  onChange={(e) => updateObjective({ primaryGoal: e.target.value })}
                  placeholder="e.g. Secure an appointment within 48 hours"
                />
              )}
            </Field>
            <Field id="expected-outcome" label="Expected Outcome">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={config.objective.expectedOutcome}
                  onChange={(e) => updateObjective({ expectedOutcome: e.target.value })}
                  placeholder="e.g. Appointment booked with confirmed date, time, and reference code"
                />
              )}
            </Field>
          </div>

          {/* Outcome Contract (Outcome Proof) */}
          <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Outcome Contract (Deterministic Outcome Proof)
              </span>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.outcomeContract?.enabled ?? false}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      outcomeContract: {
                        ...(prev.outcomeContract || {
                          action: "appointment_booking",
                          parameters: {},
                          requiredStatus: "confirmed",
                          requiredEvidence: "booking_record",
                          claimPatterns: ["booked", "confirmed", "scheduled", "appointment is set", "all set"],
                        }),
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="rounded border-border text-accent focus:ring-accent h-3.5 w-3.5"
                />
                <span className="font-medium">Require Proof</span>
              </label>
            </div>

            {config.outcomeContract?.enabled && (
              <div className="space-y-3 pt-2 border-t border-accent/20">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field id="oc-action" label="Expected Business Action">
                    {(attrs) => (
                      <Input
                        {...attrs}
                        value={config.outcomeContract?.action || "appointment_booking"}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            outcomeContract: {
                              ...prev.outcomeContract!,
                              action: e.target.value,
                            },
                          }))
                        }
                        placeholder="e.g. appointment_booking"
                      />
                    )}
                  </Field>
                  <Field id="oc-status" label="Required System Status">
                    {(attrs) => (
                      <Input
                        {...attrs}
                        value={config.outcomeContract?.requiredStatus || "confirmed"}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            outcomeContract: {
                              ...prev.outcomeContract!,
                              requiredStatus: e.target.value,
                            },
                          }))
                        }
                        placeholder="e.g. confirmed"
                      />
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field id="oc-day" label="Expected Day (Parameter)">
                    {(attrs) => (
                      <Input
                        {...attrs}
                        value={String(config.outcomeContract?.parameters?.day || "")}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            outcomeContract: {
                              ...prev.outcomeContract!,
                              parameters: {
                                ...prev.outcomeContract!.parameters,
                                day: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="e.g. Tuesday"
                      />
                    )}
                  </Field>
                  <Field id="oc-time" label="Expected Time (Parameter)">
                    {(attrs) => (
                      <Input
                        {...attrs}
                        value={String(config.outcomeContract?.parameters?.time || "")}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            outcomeContract: {
                              ...prev.outcomeContract!,
                              parameters: {
                                ...prev.outcomeContract!.parameters,
                                time: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="e.g. 3 PM"
                      />
                    )}
                  </Field>
                </div>

                <p className="text-[11px] text-muted">
                  Requires verifiable confirmation from the connected system. Verbal claims or unconfirmed tool calls alone will produce an <strong>UNVERIFIED</strong> verdict.
                </p>
              </div>
            )}
          </div>

          {/* Measurable Success / Failure Criteria */}
          <div className="space-y-4">
            <LinesField
              id="success-criteria"
              label="Success Criteria"
              hint="Conditions that indicate the test passed (one per line)."
              value={config.evaluation.successCriteria}
              onChange={(lines) => updateEvaluation({ successCriteria: lines })}
              rows={3}
            />

            <LinesField
              id="failure-conditions"
              label="Failure Conditions"
              hint="Conditions that indicate the test failed (one per line)."
              value={config.evaluation.failureConditions}
              onChange={(lines) => updateEvaluation({ failureConditions: lines })}
              rows={3}
            />

            <LinesField
              id="prohibited-outcomes"
              label="Prohibited Outcomes"
              hint="Actions or responses the agent must NEVER take (e.g. 'Inventing prices', 'Giving medical advice')."
              value={config.evaluation.prohibitedOutcomes}
              onChange={(lines) => updateEvaluation({ prohibitedOutcomes: lines })}
              rows={2}
            />
          </div>

          {/* Limits & Compatibility */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="max-turns" label="Max Conversation Turns" hint="3 to 60 turns">
              {(attrs) => (
                <Input
                  {...attrs}
                  type="number"
                  min={3}
                  max={60}
                  value={config.executionLimits.maxTurns}
                  onChange={(e) => updateLimits({ maxTurns: Number(e.target.value) })}
                />
              )}
            </Field>

            <Field id="timeout" label="Timeout (Seconds)" hint="30 to 600s">
              {(attrs) => (
                <Input
                  {...attrs}
                  type="number"
                  min={30}
                  max={600}
                  value={config.executionLimits.timeoutSeconds}
                  onChange={(e) => updateLimits({ timeoutSeconds: Number(e.target.value) })}
                />
              )}
            </Field>

            <CodesField
              id="req-caps"
              label="Required Capabilities"
              hint="Comma separated (e.g. appointment_booking)"
              value={config.compatibility.requiredCapabilities}
              onChange={(caps) => updateCompatibility({ requiredCapabilities: caps })}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !personaId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Scenario...
                </>
              ) : (
                "Save Test Scenario"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
