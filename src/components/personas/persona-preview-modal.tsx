"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { PersonaRecord } from "@/server/personas/schema";
import { evaluatePersonaReadiness } from "@/server/personas/readiness";
import { CategoryBadge, PersonaStatusBadge } from "./status-badges";

export interface PersonaPreviewModalProps {
  persona: PersonaRecord | null;
  scenarioCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (persona: PersonaRecord) => void;
  onCreateScenario: (persona: PersonaRecord) => void;
}

export function PersonaPreviewModal({
  persona,
  scenarioCount = 0,
  open,
  onOpenChange,
  onEdit,
  onCreateScenario,
}: PersonaPreviewModalProps) {
  if (!persona) return null;

  const { config } = persona;
  const p = config.personality;
  const readiness = evaluatePersonaReadiness(persona.name, config, persona.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={persona.name}
        description={persona.description || "Virtual customer persona inspection & preview"}
        className="max-h-[88vh] max-w-3xl overflow-y-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <PersonaStatusBadge status={persona.status} />
            <CategoryBadge category={persona.category} />
          </div>
          <span className="text-xs text-muted">v{persona.version} · {scenarioCount} associated scenario(s)</span>
        </div>

        {/* Readiness Banner */}
        <div
          className={`mt-3 rounded-lg border p-3.5 ${
            readiness.isReady
              ? "border-success/30 bg-success-soft text-foreground"
              : "border-warning/30 bg-warning-soft text-foreground"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {readiness.isReady ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            )}
            <div className="text-xs">
              <span className="font-semibold">
                {readiness.isReady
                  ? "Configuration is complete and ready for future testing."
                  : "Needs further configuration before being ready for simulations."}
              </span>
              {readiness.missing.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 opacity-90">
                  {readiness.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 pt-3 text-sm">
          {/* Background Context */}
          {config.background && (
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Background Context
              </h4>
              <p className="rounded-md border bg-subtle/30 p-3 text-foreground">
                {config.background}
              </p>
            </section>
          )}

          {/* Personality Matrix */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Personality & Behavior Controls
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-2.5 text-center">
                <span className="text-xs text-muted">Patience</span>
                <p className="text-lg font-bold text-foreground">{p.patienceLevel} / 5</p>
                <span className="text-[10px] text-muted">
                  {p.patienceLevel <= 2 ? "Easily Annoyed" : p.patienceLevel >= 4 ? "Very Patient" : "Moderate"}
                </span>
              </div>
              <div className="rounded-md border p-2.5 text-center">
                <span className="text-xs text-muted">Assertiveness</span>
                <p className="text-lg font-bold text-foreground">{p.assertivenessLevel} / 5</p>
                <span className="text-[10px] text-muted">
                  {p.assertivenessLevel >= 4 ? "Demanding / Direct" : p.assertivenessLevel <= 2 ? "Passive" : "Balanced"}
                </span>
              </div>
              <div className="rounded-md border p-2.5 text-center">
                <span className="text-xs text-muted">Familiarity</span>
                <p className="text-lg font-bold text-foreground">{p.familiarityLevel} / 5</p>
                <span className="text-[10px] text-muted">
                  {p.familiarityLevel <= 2 ? "First-Timer / Novice" : "Knows Terminology"}
                </span>
              </div>
              <div className="rounded-md border p-2.5 text-center">
                <span className="text-xs text-muted">Mind Change Rate</span>
                <p className="text-lg font-bold text-foreground">{p.mindChangeProbability}%</p>
                <span className="text-[10px] text-muted">Chance of shifting goal</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded-md border bg-subtle/30 p-3 text-xs">
              <div>
                <span className="font-semibold text-foreground">Communication Style: </span>
                <span className="text-muted">{p.communicationStyle}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Response to Confusion: </span>
                <span className="text-muted">{p.emotionalResponses.onConfusion}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Response to Delays: </span>
                <span className="text-muted">{p.emotionalResponses.onDelays}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Response to Repetition: </span>
                <span className="text-muted">{p.emotionalResponses.onRepetition}</span>
              </div>
            </div>
          </section>

          {/* Starting Context */}
          <section className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Starting Situation & Initial Utterance
            </h4>
            <div className="space-y-2 rounded-md border bg-subtle/30 p-3 text-xs">
              {config.startingContext.situation && (
                <div>
                  <span className="font-semibold text-foreground">Situation: </span>
                  <span className="text-muted">{config.startingContext.situation}</span>
                </div>
              )}
              {config.startingContext.initialUtterance && (
                <div className="rounded border border-accent/20 bg-accent-soft p-2 italic text-foreground">
                  &ldquo;{config.startingContext.initialUtterance}&rdquo;
                </div>
              )}
            </div>
          </section>

          {/* Objective */}
          <section className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Default Objective
            </h4>
            <div className="space-y-2 rounded-md border bg-subtle/30 p-3 text-xs">
              <p className="text-foreground">{config.defaultObjective.intent || "No intent defined."}</p>
              {config.defaultObjective.mustAchieve.length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">Must Achieve:</span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                    {config.defaultObjective.mustAchieve.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Behavioral Constraints */}
          {(config.behavioralConstraints.rules.length > 0 ||
            config.behavioralConstraints.stopConditions.length > 0) && (
            <section className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Behavioral Constraints & Guardrails
              </h4>
              <div className="space-y-2 rounded-md border bg-subtle/30 p-3 text-xs">
                {config.behavioralConstraints.rules.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">Rules:</span>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                      {config.behavioralConstraints.rules.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {config.behavioralConstraints.stopConditions.length > 0 && (
                  <div>
                    <span className="font-semibold text-foreground">Stop Conditions:</span>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                      {config.behavioralConstraints.stopConditions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Languages & Knowledge */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3 text-xs">
              <span className="font-bold text-foreground">Languages</span>
              <p className="mt-1 text-muted">
                Primary: <strong className="uppercase text-foreground">{config.language.primary}</strong>
                {config.language.additional.length > 0 &&
                  ` | Additional: ${config.language.additional.join(", ")}`}
              </p>
              {config.language.switchLanguageProbability > 0 && (
                <p className="mt-1 text-muted">
                  Switching chance: {config.language.switchLanguageProbability}%
                </p>
              )}
            </div>

            <div className="rounded-md border p-3 text-xs">
              <span className="font-bold text-foreground">Knowledge Level</span>
              <p className="mt-1 capitalize text-muted">
                Level: <strong className="text-foreground">{config.knowledge.level}</strong>
              </p>
              {config.knowledge.withheldInfo.length > 0 && (
                <p className="mt-1 text-muted">
                  Withheld info: {config.knowledge.withheldInfo.join(", ")}
                </p>
              )}
            </div>
          </section>

          {/* Phase 4 Boundary Disclaimer */}
          <div className="rounded-md border border-accent/20 bg-accent-soft p-3 text-xs text-muted">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="h-4 w-4 text-accent" />
              <span>Simulation Execution Notice</span>
            </div>
            <p className="mt-1">
              This preview displays the structured persona configuration. Live execution against ElevenLabs voice agents will be connected in <strong>Phase 4 (Test Lab)</strong>.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onEdit(persona);
            }}
          >
            Edit Persona
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onOpenChange(false);
                onCreateScenario(persona);
              }}
            >
              New Scenario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
