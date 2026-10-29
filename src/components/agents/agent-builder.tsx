"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import { agentConfigSchema, fieldErrorsOf, type AgentConfig } from "@/server/agents/config-schema";
import type { Starter } from "@/server/agents/starters";
import { ConfigEditor, type ConfigErrors } from "./config-editor";

interface Props {
  projects: { id: string; name: string }[];
  starters: readonly Starter[];
  promptMax: number;
  generationReady: boolean;
  elevenlabsReady: boolean;
  defaultProjectId?: string;
}

const UNCERTAIN = new Set(["creation_outcome_unknown", "persistence_failed_after_remote_create"]);
const newKey = () => `create-${crypto.randomUUID()}`;

export function AgentBuilder({ projects, starters, promptMax, generationReady, elevenlabsReady, defaultProjectId }: Props) {
  const router = useRouter();
  const [useCase, setUseCase] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<AgentConfig | null>(null);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [projectId, setProjectId] = React.useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [errors, setErrors] = React.useState<ConfigErrors>({});
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<{ message: string; uncertain: boolean } | null>(null);
  const creatingRef = React.useRef(false);
  const keyRef = React.useRef(newKey());
  const starter = starters.find((s) => s.id === useCase);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const r = await api<{ config: AgentConfig; openQuestions: string[] }>("/api/agents/generate", { method: "POST", json: { prompt, useCase: useCase || undefined } });
      setConfig(r.config);
      setQuestions(r.openQuestions);
      setErrors({});
      setCreateError(null);
      keyRef.current = newKey();
    } catch (err) {
      setGenError(err instanceof ApiError ? err.message : "The configuration could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    if (creatingRef.current || !config) return;
    const check = agentConfigSchema.safeParse(config);
    if (!check.success) { setErrors(fieldErrorsOf(check.error)); toast.error("Please fix the highlighted fields."); return; }
    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    setErrors({});
    try {
      const r = await api<{ agent: { id: string } }>("/api/agents", { method: "POST", json: { projectId, config: check.data, idempotencyKey: keyRef.current, creationPrompt: prompt, useCase: useCase || undefined } });
      toast.success("Agent created in ElevenLabs");
      // Stay locked while navigating away so a late click cannot submit again.
      router.push(`/agents/${r.agent.id}`);
      return;
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("The agent could not be created.", "unknown");
      if (e.fieldErrors) setErrors(e.fieldErrors);
      // Keep the same key when the outcome is uncertain so a second click can never create a duplicate.
      if (!UNCERTAIN.has(e.code) && e.code !== "conflict") keyRef.current = newKey();
      setCreateError({ message: e.message, uncertain: UNCERTAIN.has(e.code) });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Describe your agent</CardTitle><Sparkles className="h-4 w-4 text-muted" aria-hidden /></CardHeader>
        <CardBody className="space-y-4">
          {!generationReady && <Alert tone="warning" title="The generation provider is not configured">Set ANTHROPIC_API_KEY and GENERATION_MODEL on the server (see .env.example), then restart. Until then configurations cannot be generated.</Alert>}
          <Field id="use-case" label="Starting point (optional)" hint={starter?.description ?? "Pick a starting point, or leave blank and describe anything."} error={undefined}>
            {(a) => (
              <Select {...a} value={useCase} onChange={(e) => setUseCase(e.target.value)}>
                <option value="">No starter</option>
                {starters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            )}
          </Field>
          <Field id="agent-prompt" label="What should your assistant do?" hint={`${prompt.length} of ${promptMax} characters. ${starter?.promptHint ?? "Describe the business, who calls, what they ask, languages, and when to involve a person."}`} error={genError ?? undefined}>
            {(a) => <Textarea {...a} rows={6} maxLength={promptMax} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
          </Field>
          <Button onClick={generate} loading={generating} disabled={!generationReady || !prompt.trim()}>Generate agent configuration</Button>
        </CardBody>
      </Card>

      {config && (
        <>
          {questions.length > 0 && <Alert tone="warning" title="Information the generator could not find in your description">{questions.join(" ")}</Alert>}
          <h2 className="text-base font-semibold">2. Review and edit</h2>
          <ConfigEditor value={config} onChange={setConfig} errors={errors} disabled={creating} />

          <Card>
            <CardHeader><CardTitle>3. Create the agent</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              {projects.length === 0 ? (
                <Alert tone="warning" title="Create a project first">Agents belong to a project. <Link className="underline" href="/projects?new=1">Create one</Link>.</Alert>
              ) : (
                <Field id="agent-project" label="Project" error={undefined}>
                  {(a) => <Select {...a} value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
                </Field>
              )}
              {!elevenlabsReady && <Alert tone="warning" title="ElevenLabs is not configured">Set ELEVENLABS_API_KEY on the server to create the agent.</Alert>}
              {createError && (
                <Alert tone={createError.uncertain ? "warning" : "danger"} title={createError.uncertain ? "Outcome needs checking" : "The agent was not created"}>
                  {createError.message} {createError.uncertain && <Link className="underline" href="/agents">Open the Agents page</Link>}
                </Alert>
              )}
              <p className="text-xs text-muted">Creating sends the configuration to ElevenLabs and creates a real agent in your account.</p>
              <Button onClick={create} loading={creating} disabled={!elevenlabsReady || !projectId}>Create agent</Button>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
