# Test Scenario Model

## 1. Domain Purpose

A **Test Scenario** in VocaForge pairs a specific Virtual Customer Persona with a concrete mission, operational constraints, and measurable success/failure criteria. Scenarios are used to evaluate how target voice agents perform under specific conditions.

---

## 2. Scenario Schema (`scenarioConfigSchema`)

```ts
export const scenarioConfigSchema = z.object({
  objective: z.object({
    primaryGoal: z.string().trim().max(500),
    expectedOutcome: z.string().trim().max(500),
    requiredInformation: z.array(z.string().trim().min(1)).max(20),
    deliberatelyWithheld: z.array(z.string().trim().min(1)).max(20),
  }),
  startingConditions: z.object({
    situation: z.string().trim().max(1000),
    initialCustomerUtterance: z.string().trim().max(500),
  }),
  evaluation: z.object({
    successCriteria: z.array(z.string().trim().min(1)).max(30),
    failureConditions: z.array(z.string().trim().min(1)).max(30),
    prohibitedOutcomes: z.array(z.string().trim().min(1)).max(30),
  }),
  executionLimits: z.object({
    maxTurns: z.number().int().min(3).max(60),
    timeoutSeconds: z.number().int().min(30).max(600),
  }),
  compatibility: z.object({
    requiredCapabilities: z.array(z.string().trim().min(1)).max(20),
    language: z.string().optional(),
  }),
});
```

---

## 3. Priorities & Evaluation Criteria

### Priorities
- `low`: Edge exploratory tests or optional conversation flows.
- `medium`: Standard customer support and inbound journey flows.
- `high`: Core business journeys (e.g. appointment booking, account verification).
- `critical`: Compliance, security guardrail tests, escalation handling, fee billing.

### Concrete Evaluation Rubrics
- **Success Criteria**: Concrete accomplishments required before a scenario can be marked as passed (e.g., "Agent confirmed booking reference number").
- **Failure Conditions**: Explicit negative behaviors causing immediate failure (e.g., "Agent hung up without providing alternative dates").
- **Prohibited Outcomes**: Hard security/compliance violations (e.g., "Agent disclosed another customer's PII").

---

## 4. Agent Compatibility & Readiness Engine

The readiness engine (`evaluateScenarioReadiness`) performs proactive cross-checks when an agent is bound to a test scenario:
1. **Capability Cross-Checking**: Compares `scenario.config.compatibility.requiredCapabilities` against `agent.config.capabilities`. Produces actionable warnings if the target agent has not declared a required capability or has it flagged as `unavailable` or `needs_information`.
2. **Language Compatibility**: Validates whether the target agent declares support for `scenario.config.compatibility.language`.
3. **Execution Limits**: Ensures turns (3-60) and timeouts (30-600s) remain realistic for real-time voice interactions.

