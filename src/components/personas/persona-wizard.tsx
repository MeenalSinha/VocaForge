"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { LinesField } from "@/components/agents/lines-field";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import {
  type CreatePersonaInput,
  type PersonaCategory,
  type PersonaConfig,
  type PersonaRecord,
  emptyPersonaConfig,
} from "@/server/personas/schema";
import { evaluatePersonaReadiness } from "@/server/personas/readiness";
import { PERSONA_TEMPLATES, type PersonaTemplate } from "@/server/personas/templates";
import { toast } from "sonner";

export interface PersonaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialPersona?: PersonaRecord | null;
  initialTemplate?: PersonaTemplate | null;
  onSuccess: (persona: PersonaRecord) => void;
}

export function PersonaWizard({
  open,
  onOpenChange,
  projectId,
  initialPersona,
  initialTemplate,
  onSuccess,
}: PersonaWizardProps) {
  const isEditing = Boolean(initialPersona);

  const [step, setStep] = React.useState<number>(isEditing ? 2 : 1);
  const [creationMethod, setCreationMethod] = React.useState<"template" | "ai" | "scratch">("scratch");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(initialTemplate?.id || "");

  // Form states
  const [name, setName] = React.useState(initialPersona?.name || initialTemplate?.name || "");
  const [description, setDescription] = React.useState(initialPersona?.description || initialTemplate?.description || "");
  const [category, setCategory] = React.useState<PersonaCategory>(initialPersona?.category || initialTemplate?.category || "customer_experience");
  const [config, setConfig] = React.useState<PersonaConfig>(initialPersona?.config || initialTemplate?.initialConfig || emptyPersonaConfig());

  // AI Generation states
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationQuestions, setGenerationQuestions] = React.useState<string[]>([]);

  // Submission states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [traitInput, setTraitInput] = React.useState("");

  React.useEffect(() => {
    if (initialPersona) {
      setName(initialPersona.name);
      setDescription(initialPersona.description || "");
      setCategory(initialPersona.category);
      setConfig(initialPersona.config);
      setStep(2);
    } else if (initialTemplate) {
      setName(initialTemplate.name);
      setDescription(initialTemplate.description || "");
      setCategory(initialTemplate.category);
      setConfig(initialTemplate.initialConfig);
      setSelectedTemplateId(initialTemplate.id);
      setCreationMethod("template");
      setStep(2);
    } else {
      setName("");
      setDescription("");
      setCategory("customer_experience");
      setConfig(emptyPersonaConfig());
      setStep(1);
    }
    setFieldErrors({});
    setGenerationQuestions([]);
  }, [initialPersona, initialTemplate, open]);

  const updateConfig = (patch: Partial<PersonaConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const updatePersonality = (patch: Partial<PersonaConfig["personality"]>) => {
    setConfig((prev) => ({ ...prev, personality: { ...prev.personality, ...patch } }));
  };

  const updateStartingContext = (patch: Partial<PersonaConfig["startingContext"]>) => {
    setConfig((prev) => ({ ...prev, startingContext: { ...prev.startingContext, ...patch } }));
  };

  const updateObjective = (patch: Partial<PersonaConfig["defaultObjective"]>) => {
    setConfig((prev) => ({ ...prev, defaultObjective: { ...prev.defaultObjective, ...patch } }));
  };

  const updateConstraints = (patch: Partial<PersonaConfig["behavioralConstraints"]>) => {
    setConfig((prev) => ({ ...prev, behavioralConstraints: { ...prev.behavioralConstraints, ...patch } }));
  };

  const updateKnowledge = (patch: Partial<PersonaConfig["knowledge"]>) => {
    setConfig((prev) => ({ ...prev, knowledge: { ...prev.knowledge, ...patch } }));
  };

  const updateLanguage = (patch: Partial<PersonaConfig["language"]>) => {
    setConfig((prev) => ({ ...prev, language: { ...prev.language, ...patch } }));
  };

  // AI generation handler
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a description of the customer.");
      return;
    }
    setIsGenerating(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          category,
          templateId: selectedTemplateId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to generate customer profile.");
      }
      const data = json.data;
      setName(data.name || name || "Generated Virtual Customer");
      setDescription(data.description || description);
      if (data.category) setCategory(data.category);
      if (data.config) setConfig(data.config);
      setGenerationQuestions(data.openQuestions || []);
      toast.success("Virtual customer profile generated! Review and customize the details.");
      setStep(2);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Template select handler
  const handleSelectTemplate = (template: PersonaTemplate) => {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setDescription(template.description);
    setCategory(template.category);
    setConfig(template.initialConfig);
    setStep(2);
  };

  // Trait helpers
  const addTrait = () => {
    const t = traitInput.trim();
    if (t && !config.personality.traits.includes(t)) {
      updatePersonality({ traits: [...config.personality.traits, t] });
      setTraitInput("");
    }
  };

  const removeTrait = (trait: string) => {
    updatePersonality({ traits: config.personality.traits.filter((t) => t !== trait) });
  };

  // Final submit handler
  const handleSubmit = async () => {
    if (!name.trim()) {
      setFieldErrors({ name: ["Name is required."] });
      setStep(2);
      return;
    }
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      if (isEditing && initialPersona) {
        const res = await fetch(`/api/personas/${initialPersona.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            category,
            config,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.error?.fieldErrors) setFieldErrors(json.error.fieldErrors);
          throw new Error(json.error?.message || "Failed to update virtual customer.");
        }
        toast.success(`Virtual customer "${name}" updated.`);
        onSuccess(json.data.persona);
        onOpenChange(false);
      } else {
        const payload: CreatePersonaInput = {
          projectId,
          name,
          description,
          category,
          templateId: selectedTemplateId || null,
          config,
        };
        const res = await fetch("/api/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.error?.fieldErrors) setFieldErrors(json.error.fieldErrors);
          throw new Error(json.error?.message || "Failed to create virtual customer.");
        }
        toast.success(`Virtual customer "${name}" saved.`);
        onSuccess(json.data.persona);
        onOpenChange(false);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const readiness = evaluatePersonaReadiness(name, config, isEditing ? initialPersona?.status : "draft");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? `Edit Virtual Customer: ${initialPersona?.name}` : "Create Virtual Customer"}
        description={
          isEditing
            ? "Modify this customer's behavior, personality traits, and test objectives."
            : "Design a realistic virtual customer to test your voice AI agent under real conditions."
        }
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        {/* Wizard Steps Navigation */}
        <div className="flex items-center justify-between border-b pb-3 pt-1 text-xs">
          {[
            { n: 1, label: "Method", hideOnEdit: true },
            { n: 2, label: "Identity" },
            { n: 3, label: "Personality" },
            { n: 4, label: "Objective" },
            { n: 5, label: "Constraints" },
            { n: 6, label: "Review & Save" },
          ]
            .filter((s) => !isEditing || !s.hideOnEdit)
            .map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`flex items-center gap-1.5 font-medium transition-colors ${
                  step === s.n
                    ? "text-accent"
                    : step > s.n
                    ? "text-foreground"
                    : "text-muted opacity-60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    step === s.n
                      ? "bg-accent text-accent-foreground font-bold"
                      : step > s.n
                      ? "bg-subtle text-foreground"
                      : "border text-muted"
                  }`}
                >
                  {s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
        </div>

        {/* STEP 1: METHOD SELECTION */}
        {step === 1 && !isEditing && (
          <div className="space-y-4 py-2">
            <h4 className="text-sm font-semibold">How would you like to start?</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setCreationMethod("template")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  creationMethod === "template"
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-border hover:border-accent"
                }`}
              >
                <div className="text-base font-semibold text-foreground">Browse Templates</div>
                <p className="mt-1 text-xs text-muted">
                  Start with a proven customer profile (Impatient, Confused, Bargain-Hunter, etc.).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCreationMethod("ai")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  creationMethod === "ai"
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-border hover:border-accent"
                }`}
              >
                <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-warning" />
                  Describe with AI
                </div>
                <p className="mt-1 text-xs text-muted">
                  Type a plain-language description and let our AI create the structured personality.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreationMethod("scratch");
                  setStep(2);
                }}
                className={`rounded-lg border p-4 text-left transition-all ${
                  creationMethod === "scratch"
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-border hover:border-accent"
                }`}
              >
                <div className="text-base font-semibold text-foreground">Build from Scratch</div>
                <p className="mt-1 text-xs text-muted">
                  Define every personality parameter, rule, and objective manually.
                </p>
              </button>
            </div>

            {creationMethod === "template" && (
              <div className="mt-4 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Select a Starting Template
                </h5>
                <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto sm:grid-cols-2">
                  {PERSONA_TEMPLATES.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="cursor-pointer rounded-md border p-3 transition-colors hover:border-accent hover:bg-subtle/50"
                    >
                      <div className="font-semibold text-foreground">{t.name}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">
                        {t.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {creationMethod === "ai" && (
              <div className="mt-4 space-y-3 rounded-lg border bg-subtle/30 p-4">
                <Field
                  id="ai-prompt"
                  label="Describe the customer"
                  hint="E.g.: An impatient customer who needs an emergency appointment within 24 hours, dislikes repetitive questions, and asks about pricing."
                >
                  {(attrs) => (
                    <Textarea
                      {...attrs}
                      rows={4}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe what kind of customer you want to simulate..."
                    />
                  )}
                </Field>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Configuration...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4 text-warning" />
                        Generate Customer Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: IDENTITY & CONTEXT */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="name" label="Customer Name" error={fieldErrors.name?.[0]}>
                {(attrs) => (
                  <Input
                    {...attrs}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Impatient Caller (Rush Hour)"
                  />
                )}
              </Field>

              <Field id="category" label="Category">
                {(attrs) => (
                  <select
                    {...attrs}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PersonaCategory)}
                    className="flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="customer_experience">Customer Experience</option>
                    <option value="pricing_policies">Pricing & Policies</option>
                    <option value="communication">Communication</option>
                    <option value="support">Support</option>
                    <option value="custom">Custom</option>
                  </select>
                )}
              </Field>
            </div>

            <Field id="description" label="Short Summary">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Calls in a rush and demands an appointment within 48h."
                />
              )}
            </Field>

            <Field id="background" label="Background Context" hint="Who is this caller? What situation are they in?">
              {(attrs) => (
                <Textarea
                  {...attrs}
                  rows={3}
                  value={config.background}
                  onChange={(e) => updateConfig({ background: e.target.value })}
                  placeholder="e.g. Busy professional calling between meetings from a noisy train station."
                />
              )}
            </Field>

            <Field id="situation" label="Starting Situation" hint="What is happening at the very beginning of the call?">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={config.startingContext.situation}
                  onChange={(e) => updateStartingContext({ situation: e.target.value })}
                  placeholder="e.g. Has 2 minutes before boarding a train, needs next-day slot."
                />
              )}
            </Field>

            <Field id="initial-utterance" label="Initial Utterance" hint="The first sentence the virtual customer speaks when connected.">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={config.startingContext.initialUtterance}
                  onChange={(e) => updateStartingContext({ initialUtterance: e.target.value })}
                  placeholder="e.g. Hi, I need an urgent slot tomorrow or day after. What do you have?"
                />
              )}
            </Field>
          </div>
        )}

        {/* STEP 3: PERSONALITY & BEHAVIOR */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <Field id="comm-style" label="Communication Style">
              {(attrs) => (
                <Input
                  {...attrs}
                  value={config.personality.communicationStyle}
                  onChange={(e) => updatePersonality({ communicationStyle: e.target.value })}
                  placeholder="e.g. Abrupt, fast-paced, interrupts if responses are long-winded."
                />
              )}
            </Field>

            {/* Numerical Sliders/Controls with clear descriptions */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <label className="text-xs font-semibold text-foreground">
                  Patience Level: {config.personality.patienceLevel}/5
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={config.personality.patienceLevel}
                  onChange={(e) => updatePersonality({ patienceLevel: Number(e.target.value) })}
                  className="mt-2 w-full accent-accent"
                />
                <span className="text-[11px] text-muted">
                  {config.personality.patienceLevel === 1 && "1: Easily annoyed, cuts off delays"}
                  {config.personality.patienceLevel === 2 && "2: Impatient, short tolerance"}
                  {config.personality.patienceLevel === 3 && "3: Average, polite but expects answers"}
                  {config.personality.patienceLevel === 4 && "4: Patient and accommodating"}
                  {config.personality.patienceLevel === 5 && "5: Exceptionally patient, waits calmly"}
                </span>
              </div>

              <div className="rounded-lg border p-3">
                <label className="text-xs font-semibold text-foreground">
                  Assertiveness: {config.personality.assertivenessLevel}/5
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={config.personality.assertivenessLevel}
                  onChange={(e) => updatePersonality({ assertivenessLevel: Number(e.target.value) })}
                  className="mt-2 w-full accent-accent"
                />
                <span className="text-[11px] text-muted">
                  {config.personality.assertivenessLevel === 1 && "1: Passive, easily persuaded"}
                  {config.personality.assertivenessLevel === 2 && "2: Mild, hesitates to push"}
                  {config.personality.assertivenessLevel === 3 && "3: Direct and clear"}
                  {config.personality.assertivenessLevel === 4 && "4: Firm, demands answers"}
                  {config.personality.assertivenessLevel === 5 && "5: Very demanding / stubborn"}
                </span>
              </div>

              <div className="rounded-lg border p-3">
                <label className="text-xs font-semibold text-foreground">
                  Familiarity: {config.personality.familiarityLevel}/5
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={config.personality.familiarityLevel}
                  onChange={(e) => updatePersonality({ familiarityLevel: Number(e.target.value) })}
                  className="mt-2 w-full accent-accent"
                />
                <span className="text-[11px] text-muted">
                  {config.personality.familiarityLevel === 1 && "1: Complete novice, confused by jargon"}
                  {config.personality.familiarityLevel === 2 && "2: Basic user"}
                  {config.personality.familiarityLevel === 3 && "3: Familiar with process"}
                  {config.personality.familiarityLevel === 4 && "4: Advanced knowledge"}
                  {config.personality.familiarityLevel === 5 && "5: Expert, tests edge cases"}
                </span>
              </div>
            </div>

            {/* Emotional Triggers */}
            <div className="space-y-3 rounded-lg border bg-subtle/30 p-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Emotional Responses
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field id="on-confusion" label="On Confusion">
                  {(attrs) => (
                    <Input
                      {...attrs}
                      value={config.personality.emotionalResponses.onConfusion}
                      onChange={(e) =>
                        updatePersonality({
                          emotionalResponses: {
                            ...config.personality.emotionalResponses,
                            onConfusion: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. Asks for simple explanation"
                    />
                  )}
                </Field>

                <Field id="on-delays" label="On Delays">
                  {(attrs) => (
                    <Input
                      {...attrs}
                      value={config.personality.emotionalResponses.onDelays}
                      onChange={(e) =>
                        updatePersonality({
                          emotionalResponses: {
                            ...config.personality.emotionalResponses,
                            onDelays: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. Says 'I am in a hurry'"
                    />
                  )}
                </Field>

                <Field id="on-repetition" label="On Repetition">
                  {(attrs) => (
                    <Input
                      {...attrs}
                      value={config.personality.emotionalResponses.onRepetition}
                      onChange={(e) =>
                        updatePersonality({
                          emotionalResponses: {
                            ...config.personality.emotionalResponses,
                            onRepetition: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. Says 'I already told you that'"
                    />
                  )}
                </Field>
              </div>
            </div>

            {/* Traits list */}
            <div>
              <label className="text-xs font-semibold text-foreground">Personality Traits</label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={traitInput}
                  onChange={(e) => setTraitInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTrait())}
                  placeholder="e.g. skeptical, demanding, polite..."
                />
                <Button type="button" variant="secondary" onClick={addTrait}>
                  Add Trait
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {config.personality.traits.map((t, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded-full border bg-surface px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTrait(t)}
                      className="text-muted hover:text-danger"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: DEFAULT OBJECTIVE */}
        {step === 4 && (
          <div className="space-y-4 py-2">
            <Field id="objective-intent" label="Primary Intent / Goal" hint="What does this virtual customer want to accomplish on the call?">
              {(attrs) => (
                <Textarea
                  {...attrs}
                  rows={3}
                  value={config.defaultObjective.intent}
                  onChange={(e) => updateObjective({ intent: e.target.value })}
                  placeholder="e.g. Book an appointment within the next 48 hours without spending more than 2 minutes on the phone."
                />
              )}
            </Field>

            <LinesField
              id="must-achieve"
              label="Must Achieve Deliverables"
              hint="List the specific outcomes required for the customer to consider the call complete (one per line)."
              value={config.defaultObjective.mustAchieve}
              onChange={(lines) => updateObjective({ mustAchieve: lines })}
              rows={4}
            />
          </div>
        )}

        {/* STEP 5: CONSTRAINTS & KNOWLEDGE */}
        {step === 5 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="knowledge-level" label="Knowledge Level">
                {(attrs) => (
                  <select
                    {...attrs}
                    value={config.knowledge.level}
                    onChange={(e) => updateKnowledge({ level: e.target.value as PersonaConfig["knowledge"]["level"] })}
                    className="flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="none">None (Total novice)</option>
                    <option value="basic">Basic (General idea)</option>
                    <option value="intermediate">Intermediate (Knows common terms)</option>
                    <option value="expert">Expert (Knows exact procedures)</option>
                  </select>
                )}
              </Field>

              <Field id="primary-lang" label="Primary Language Code" hint="2-letter code like 'en', 'es', 'hi'">
                {(attrs) => (
                  <Input
                    {...attrs}
                    value={config.language.primary}
                    onChange={(e) => updateLanguage({ primary: e.target.value.trim().toLowerCase() })}
                    placeholder="en"
                  />
                )}
              </Field>
            </div>

            <LinesField
              id="withheld-info"
              label="Deliberately Withheld Information"
              hint="Information the customer will NOT disclose initially unless specifically probed (one per line)."
              value={config.knowledge.withheldInfo}
              onChange={(lines) => updateKnowledge({ withheldInfo: lines })}
              rows={2}
            />

            <LinesField
              id="rules"
              label="Behavioral Rules"
              hint="Rules guiding customer behavior (e.g. 'Refuse dates after Friday', 'Ask for supervisor if price > $100')."
              value={config.behavioralConstraints.rules}
              onChange={(lines) => updateConstraints({ rules: lines })}
              rows={3}
            />

            <LinesField
              id="stop-conditions"
              label="Stop Conditions"
              hint="Conditions under which the customer ends the call (one per line)."
              value={config.behavioralConstraints.stopConditions}
              onChange={(lines) => updateConstraints({ stopConditions: lines })}
              rows={2}
            />
          </div>
        )}

        {/* STEP 6: REVIEW & SAVE */}
        {step === 6 && (
          <div className="space-y-4 py-2">
            {/* Readiness Banner */}
            <div
              className={`rounded-lg border p-3 ${
                readiness.isReady
                  ? "border-success/30 bg-success-soft text-foreground"
                  : "border-warning/30 bg-warning-soft text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                {readiness.isReady ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-warning" />
                )}
                <span>
                  {readiness.isReady
                    ? "Persona is complete and ready for future testing."
                    : "Needs more details before it can be marked ready."}
                </span>
              </div>
              {readiness.missing.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs opacity-90">
                  {readiness.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>

            {generationQuestions.length > 0 && (
              <div className="rounded-md border bg-subtle/30 p-3 text-xs">
                <span className="font-semibold text-foreground">AI Assumptions / Open Questions:</span>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                  {generationQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border bg-subtle/20 p-4 text-xs space-y-3">
              <div>
                <span className="font-bold text-foreground">Name: </span>
                <span>{name || "(Untitled Customer)"}</span>
              </div>
              <div>
                <span className="font-bold text-foreground">Category: </span>
                <span className="capitalize">{category.replace("_", " ")}</span>
              </div>
              <div>
                <span className="font-bold text-foreground">Objective: </span>
                <span>{config.defaultObjective.intent || "(No objective defined)"}</span>
              </div>
              <div>
                <span className="font-bold text-foreground">Patience / Assertiveness / Familiarity: </span>
                <span>
                  {config.personality.patienceLevel}/5 · {config.personality.assertivenessLevel}/5 · {config.personality.familiarityLevel}/5
                </span>
              </div>
              {config.personality.traits.length > 0 && (
                <div>
                  <span className="font-bold text-foreground">Traits: </span>
                  <span>{config.personality.traits.join(", ")}</span>
                </div>
              )}
              {config.startingContext.initialUtterance && (
                <div className="rounded border border-accent/20 bg-accent-soft p-2 italic">
                  &ldquo;{config.startingContext.initialUtterance}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div>
            {step > (isEditing ? 2 : 1) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            {step < 6 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={isSubmitting || !name.trim()}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Virtual Customer"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
