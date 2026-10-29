"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { AgentConfig } from "@/server/agents/config-schema";
import { localOnlyNotes } from "@/server/agents/prompt";
import { CodesField, LinesField } from "./lines-field";
import { VoicePicker } from "./voice-picker";

export type ConfigErrors = Record<string, string[]>;

export function ConfigEditor({ value, onChange, errors, disabled }: { value: AgentConfig; onChange: (c: AgentConfig) => void; errors: ConfigErrors; disabled?: boolean }) {
  const set = (fn: (c: AgentConfig) => void) => { const c = structuredClone(value); fn(c); onChange(c); };
  const err = (path: string) => errors[path]?.[0];

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <Card>
        <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <Field id="cfg-name" label="Agent name" error={err("identity.name")}>{(a) => <Input {...a} value={value.identity.name} maxLength={100} onChange={(e) => set((c) => { c.identity.name = e.target.value; })} />}</Field>
          <Field id="cfg-description" label="Description (optional)" error={err("identity.description")}>{(a) => <Textarea {...a} rows={2} value={value.identity.description} onChange={(e) => set((c) => { c.identity.description = e.target.value; })} />}</Field>
          <Field id="cfg-role" label="Role" hint="Who the agent is, in one or two sentences." error={err("identity.role")}>{(a) => <Textarea {...a} rows={2} value={value.identity.role} onChange={(e) => set((c) => { c.identity.role = e.target.value; })} />}</Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <Field id="cfg-purpose" label="Purpose" error={err("behavior.purpose")}>{(a) => <Textarea {...a} rows={2} value={value.behavior.purpose} onChange={(e) => set((c) => { c.behavior.purpose = e.target.value; })} />}</Field>
          <LinesField id="cfg-goals" label="Main goals" error={err("behavior.goals")} value={value.behavior.goals} onChange={(v) => set((c) => { c.behavior.goals = v; })} />
          <Field id="cfg-welcome" label="Welcome message" hint="The first thing the agent says." error={err("behavior.welcomeMessage")}>{(a) => <Textarea {...a} rows={2} value={value.behavior.welcomeMessage} onChange={(e) => set((c) => { c.behavior.welcomeMessage = e.target.value; })} />}</Field>
          <Field id="cfg-instructions" label="Conversation instructions" error={err("behavior.instructions")}>{(a) => <Textarea {...a} rows={6} value={value.behavior.instructions} onChange={(e) => set((c) => { c.behavior.instructions = e.target.value; })} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cfg-tone" label="Tone" error={err("behavior.tone")}>{(a) => <Input {...a} value={value.behavior.tone} onChange={(e) => set((c) => { c.behavior.tone = e.target.value; })} />}</Field>
            <Field id="cfg-style" label="Response style (optional)" error={err("behavior.responseStyle")}>{(a) => <Input {...a} value={value.behavior.responseStyle} onChange={(e) => set((c) => { c.behavior.responseStyle = e.target.value; })} />}</Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Knowledge</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <Alert title="Knowledge files are not connected yet">These notes describe where answers should come from. Uploading documents to the agent is not part of this phase, so the agent can only use what you write in its instructions.</Alert>
          <LinesField id="cfg-sources" label="Information the agent may use" error={err("knowledge.sources")} value={value.knowledge.sources} onChange={(v) => set((c) => { c.knowledge.sources = v; })} />
          <LinesField id="cfg-noinvent" label="Information it must never invent" error={err("knowledge.mustNotInvent")} value={value.knowledge.mustNotInvent} onChange={(v) => set((c) => { c.knowledge.mustNotInvent = v; })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Language and voice</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cfg-lang" label="Primary language code" hint="For example en, hi, es." error={err("language.primary")}>{(a) => <Input {...a} value={value.language.primary} onChange={(e) => set((c) => { c.language.primary = e.target.value; })} />}</Field>
            <CodesField id="cfg-langs" label="Additional language codes" hint="Comma separated. Described in the prompt only." error={err("language.additional")} value={value.language.additional} onChange={(v) => set((c) => { c.language.additional = v; })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cfg-stability" label="Voice stability (optional)" hint="0 to 1" error={err("voice.stability")}>{(a) => <Input {...a} type="number" step="0.05" min={0} max={1} value={value.voice.stability ?? ""} onChange={(e) => set((c) => { c.voice.stability = e.target.value === "" ? undefined : Number(e.target.value); })} />}</Field>
            <Field id="cfg-speed" label="Voice speed (optional)" hint="0.7 to 1.2" error={err("voice.speed")}>{(a) => <Input {...a} type="number" step="0.05" min={0.7} max={1.2} value={value.voice.speed ?? ""} onChange={(e) => set((c) => { c.voice.speed = e.target.value === "" ? undefined : Number(e.target.value); })} />}</Field>
          </div>
          <VoicePicker value={value.voice.voiceId} previewText={value.behavior.welcomeMessage || "Hello, how can I help you today?"} onSelect={(id) => set((c) => { c.voice.voiceId = id; })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Guardrails</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <LinesField id="cfg-prohibited" label="Actions the agent must never take" error={err("guardrails.prohibitedActions")} value={value.guardrails.prohibitedActions} onChange={(v) => set((c) => { c.guardrails.prohibitedActions = v; })} />
          <LinesField id="cfg-restricted" label="Restricted information" error={err("guardrails.restrictedInformation")} value={value.guardrails.restrictedInformation} onChange={(v) => set((c) => { c.guardrails.restrictedInformation = v; })} />
          <LinesField id="cfg-escalate" label="Hand off to a human when" error={err("guardrails.escalationConditions")} value={value.guardrails.escalationConditions} onChange={(v) => set((c) => { c.guardrails.escalationConditions = v; })} />
          <Field id="cfg-uncertain" label="When the agent is unsure" error={err("guardrails.uncertaintyRules")}>{(a) => <Textarea {...a} rows={2} value={value.guardrails.uncertaintyRules} onChange={(e) => set((c) => { c.guardrails.uncertaintyRules = e.target.value; })} />}</Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Requested capabilities</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {value.capabilities.length === 0 ? <p className="text-sm text-muted">No special capabilities were requested.</p> : (
            <ul className="space-y-2">
              {value.capabilities.map((cap, i) => (
                <li key={`${cap.name}-${i}`} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="font-medium">{cap.name} <Badge tone="warning">{cap.status === "needs_information" ? "Needs information" : "Not available yet"}</Badge></p>
                    {cap.description && <p className="text-sm text-muted">{cap.description}</p>}
                    {cap.note && <p className="text-xs text-muted">{cap.note}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => set((c) => { c.capabilities.splice(i, 1); })} aria-label={`Remove ${cap.name}`}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">{localOnlyNotes(value).map((n) => <li key={n}>{n}</li>)}</ul>
        </CardBody>
      </Card>
    </fieldset>
  );
}
