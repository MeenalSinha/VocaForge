# Virtual Customer Persona Model

## 1. Domain Purpose

A **Virtual Customer Persona** in VocaForge represents a realistic caller archetype used to systematically stress-test conversational voice AI agents. Personas define behavioral tendencies, background context, emotional response patterns, knowledge boundaries, and language preferences.

---

## 2. Persona Schema & Structure (`personaConfigSchema`)

```ts
export const personaConfigSchema = z.object({
  background: z.string().trim().max(2000),
  personality: z.object({
    traits: z.array(z.string().trim().min(1)).max(20),
    communicationStyle: z.string().trim().max(500),
    patienceLevel: z.number().int().min(1).max(5),
    assertivenessLevel: z.number().int().min(1).max(5),
    familiarityLevel: z.number().int().min(1).max(5),
    emotionalResponses: z.object({
      onConfusion: z.string().trim().max(300),
      onDelays: z.string().trim().max(300),
      onRepetition: z.string().trim().max(300),
    }),
    mindChangeProbability: z.number().min(0).max(100),
  }),
  knowledge: z.object({
    level: z.enum(["none", "basic", "intermediate", "expert"]),
    assumptions: z.array(z.string().trim().min(1)).max(20),
    withheldInfo: z.array(z.string().trim().min(1)).max(20),
  }),
  language: z.object({
    primary: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    additional: z.array(z.string()),
    switchLanguageProbability: z.number().min(0).max(100),
  }),
  startingContext: z.object({
    situation: z.string().trim().max(1000),
    initialUtterance: z.string().trim().max(500),
  }),
  defaultObjective: z.object({
    intent: z.string().trim().max(500),
    mustAchieve: z.array(z.string().trim().min(1)).max(20),
  }),
  behavioralConstraints: z.object({
    rules: z.array(z.string().trim().min(1)).max(30),
    stopConditions: z.array(z.string().trim().min(1)).max(20),
  }),
});
```

---

## 3. Categories & Statuses

### Categories
- `customer_experience`: First-time callers, impatient executives, VIPs, conversational style tests.
- `pricing_policies`: Discount seekers, policy challengers, billing disputers, price sensitivity tests.
- `communication`: Non-native speakers, code-switching callers, verbose talkers, terse callers.
- `support`: Frustrated callers, previous bad experience escalations, technical troubleshooting, accessibility.
- `custom`: Tailored enterprise-specific caller archetypes.

### Lifecycle Statuses
- `draft`: Incomplete or actively being edited.
- `needs_configuration`: Missing essential attributes for simulation.
- `ready_for_testing`: Fully validated configuration with all required objective and context fields.
- `archived`: Soft-deleted, hidden from primary views, preserved for historic audit trails.

---

## 4. Starter Templates (10 Curated Archetypes)

1. **Impatient Customer**: Urgent caller with high assertiveness and low patience.
2. **Confused First-Time Customer**: Novice caller unfamiliar with jargon.
3. **Detail-Oriented Customer**: Analytical caller asking precise confirmation questions.
4. **Price-Sensitive Customer**: Reluctant to spend, questions every line-item cost.
5. **Discount-Seeking Negotiator**: Actively negotiates promos and threatens churn.
6. **Policy Challenger**: Refuses standard policies and demands exceptions.
7. **Multilingual / Non-Native Speaker**: Speaks measured English with occasional code-switching.
8. **Incomplete Information Caller**: Omits key booking details until specifically prompted.
9. **Frustrated Escalation Caller**: Agitated from previous bad experience, demands immediate resolution.
10. **Elderly Caller Needing Assistance**: Measured, polite caller who values patience, reassurance, and clarity.

