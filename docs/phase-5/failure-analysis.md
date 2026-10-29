# Phase 5 — Failure Analysis Engine

## Overview
The Failure Analysis Engine in VocaForge analyzes failed simulation test runs (`failed_evaluation`, `inconclusive`, or `infrastructure_error`) to diagnose the underlying behavioral fault, isolate exact dialogue quotes as empirical evidence, and classify failures into standardized categories.

## 12 Standardized Failure Categories

| Category | Label | Description |
|---|---|---|
| `unsupported_answer` | Unsupported or Incorrect Answer | The agent gave factually inaccurate, hallucinated, or ungrounded statements not supported by knowledge. |
| `objective_failed` | Objective Not Accomplished | The agent failed to fulfill the simulated caller's stated primary goal or required outcome. |
| `unnecessary_repetition` | Unnecessary Repetition | The agent repeatedly prompted for information already provided or gave redundant, circular answers. |
| `missing_information` | Missing Information Handling | The agent failed to properly ask for or manage required or deliberately withheld customer information. |
| `policy_violation` | Guardrail or Policy Violation | The agent violated explicit business constraints, promised unauthorized terms, or failed to escalate. |
| `incorrect_tool_usage` | Incorrect Tool Usage | The agent invoked a tool with invalid parameters or called a capability inappropriately. |
| `tool_execution_failed` | Tool Execution Failure | An external integration or capability call returned an error or unhandled failure response. |
| `language_barrier` | Language Handling Problem | The agent failed to understand or communicate in the customer's language or dialect. |
| `premature_end` | Premature Termination | The agent hung up or ended the call before the customer's flow or inquiry concluded. |
| `excessive_turns` | Excessive Conversation Turns | The conversation exceeded acceptable duration thresholds without reaching a resolution. |
| `contradictory_response` | Contradictory Responses | The agent contradicted its own statements across different conversation turns. |
| `insufficient_evidence` | Insufficient Evidence | The evaluation failed remotely, but the transcript lacks sufficient turn evidence to pinpoint an agent fault. |

## Deterministic Diagnostics Before AI Analysis
To maximize speed, cost-effectiveness, and reproducibility, the analyzer executes deterministic checks first:
1. **Premature Call Termination**: Triggered when a run with status `failed_evaluation` contains $\le 1$ conversation turns. Classified immediately as `premature_end` with critical severity and proven confidence.
2. **Infrastructure Error Isolation**: If a run failed due to network timeout or gateway dispatch error (`infrastructure_error`), the engine tags it as `insufficient_evidence` with `isActionable = false`. This guarantees agents are never blamed for remote provider infrastructure faults.

## Transcript Evidence Citations
Every generated `FailureFindingRecord` includes an `evidenceReferences` array containing:
- `messageIndex`: Exact integer index in the persistent conversation transcript.
- `role`: Role of the speaker (`user`, `agent`, or `system`).
- `excerpt`: Verbatim text quote from the transcript.
- `timeInCallSecs`: Timestamp in the audio call when the quote occurred.
- `note`: Contextual explanation of the citation.

