import { describe, expect, it, vi } from "vitest";
import { GenerationError, type GenerationProvider } from "@/server/generation/provider";
import { generatePersonaConfig } from "@/server/personas/generation";
import { ValidationError } from "@/server/errors";
import type { PersonaCategory } from "@/server/personas/schema";

const mockDraft = (name: string, category: PersonaCategory = "customer_experience", extra: object = {}) => ({
  name,
  description: `Generated persona for ${name}`,
  category,
  background: "Long-time customer wanting to resolve an issue.",
  personality: {
    traits: ["direct", "demanding"],
    communicationStyle: "Concise and direct",
    patienceLevel: 2,
    assertivenessLevel: 4,
    familiarityLevel: 3,
    emotionalResponses: {
      onConfusion: "Asks for clarity",
      onDelays: "Pushes assistant",
      onRepetition: "Notes repetition",
    },
    mindChangeProbability: 15,
  },
  knowledge: {
    level: "intermediate",
    assumptions: ["Agents have all records"],
    withheldInfo: ["Account pin until asked"],
  },
  language: {
    primary: "en",
    additional: [],
    switchLanguageProbability: 0,
  },
  startingContext: {
    situation: "Calling to verify a refund status",
    initialUtterance: "Hi, I need to check the status of my refund.",
  },
  defaultObjective: {
    intent: "Confirm refund transfer date",
    mustAchieve: ["Refund date and confirmation number"],
  },
  behavioralConstraints: {
    rules: ["Do not accept vague answers"],
    stopConditions: ["Date provided or escalated"],
  },
  openQuestions: ["What date was the original purchase?"],
  ...extra,
});

const mockProvider = (impl: (req: { user: string; system: string }) => unknown): GenerationProvider => ({
  generate: vi.fn(async (req) => impl(req)),
});

describe("generatePersonaConfig", () => {
  it("returns a validated persona configuration derived from the provider output", async () => {
    const p = mockProvider(() => mockDraft("Sarah Jenkins", "customer_experience"));
    const res = await generatePersonaConfig({ prompt: "A direct customer checking a refund" }, p);

    expect(res.name).toBe("Sarah Jenkins");
    expect(res.category).toBe("customer_experience");
    expect(res.config.personality.traits).toContain("direct");
    expect(res.config.personality.patienceLevel).toBe(2);
    expect(res.config.startingContext.initialUtterance).toContain("refund");
    expect(res.openQuestions).toContain("What date was the original purchase?");
  });

  it("produces different configurations for different provider outputs", async () => {
    const a = await generatePersonaConfig({ prompt: "first" }, mockProvider(() => mockDraft("Persona A")));
    const b = await generatePersonaConfig({ prompt: "second" }, mockProvider(() => mockDraft("Persona B")));

    expect(a.name).not.toBe(b.name);
    expect(a.config.personality.traits).toEqual(b.config.personality.traits);
  });

  it("includes template guidance in system prompt when templateId is provided", async () => {
    const p = mockProvider(() => mockDraft("Fast Caller"));
    await generatePersonaConfig(
      { prompt: "Need an impatient caller", templateId: "impatient-customer" },
      p,
    );

    const callArgs = (p.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(callArgs.system).toContain("Base Template");
    expect(callArgs.system).toContain("Impatient Customer");
    expect(callArgs.user).toContain("Need an impatient caller");
  });

  it("prefers input.category over draft category if supplied", async () => {
    const p = mockProvider(() => mockDraft("Test", "customer_experience"));
    const res = await generatePersonaConfig(
      { prompt: "A support persona", category: "support" },
      p,
    );
    expect(res.category).toBe("support");
  });

  it("rejects malformed model output with invalid_output GenerationError", async () => {
    const p = mockProvider(() => ({ name: "" })); // Invalid empty name
    const err = (await generatePersonaConfig({ prompt: "Some prompt" }, p).catch((e) => e)) as GenerationError;

    expect(err).toBeInstanceOf(GenerationError);
    expect(err.kind).toBe("invalid_output");
  });

  it("propagates provider errors without fabricating data", async () => {
    const failingProvider: GenerationProvider = {
      generate: async () => {
        throw new GenerationError("rate_limited", "Rate limit reached.");
      },
    };

    await expect(
      generatePersonaConfig({ prompt: "Some prompt" }, failingProvider),
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("validates prompt presence and length before invoking provider", async () => {
    const p = mockProvider(() => mockDraft("Should Not Run"));

    await expect(generatePersonaConfig({ prompt: "  " }, p)).rejects.toBeInstanceOf(ValidationError);
    await expect(generatePersonaConfig({ prompt: "x".repeat(4001) }, p)).rejects.toBeInstanceOf(ValidationError);
    expect(p.generate).not.toHaveBeenCalled();
  });
});

