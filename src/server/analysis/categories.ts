export const FAILURE_CATEGORIES = [
  "unsupported_answer",
  "objective_failed",
  "unnecessary_repetition",
  "missing_information",
  "policy_violation",
  "incorrect_tool_usage",
  "tool_execution_failed",
  "language_barrier",
  "premature_end",
  "excessive_turns",
  "contradictory_response",
  "insufficient_evidence",
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export interface CategoryInfo {
  category: FailureCategory;
  label: string;
  description: string;
}

export const CATEGORY_DEFINITIONS: Record<FailureCategory, CategoryInfo> = {
  unsupported_answer: {
    category: "unsupported_answer",
    label: "Unsupported or Incorrect Answer",
    description: "The agent gave factually inaccurate, hallucinated, or unsupported information not grounded in knowledge.",
  },
  objective_failed: {
    category: "objective_failed",
    label: "Objective Not Accomplished",
    description: "The agent failed to satisfy the caller's stated primary objective or required outcome.",
  },
  unnecessary_repetition: {
    category: "unnecessary_repetition",
    label: "Unnecessary Repetition",
    description: "The agent repeatedly asked for information already supplied or gave circular answers.",
  },
  missing_information: {
    category: "missing_information",
    label: "Missing Information Handling",
    description: "The agent did not properly request, acknowledge, or handle required or deliberately withheld customer information.",
  },
  policy_violation: {
    category: "policy_violation",
    label: "Guardrail or Policy Violation",
    description: "The agent violated defined business constraints, promised unauthorized terms, or failed to escalate.",
  },
  incorrect_tool_usage: {
    category: "incorrect_tool_usage",
    label: "Incorrect Tool Usage",
    description: "The agent invoked a tool with wrong parameters or called a tool inappropriately during the conversation.",
  },
  tool_execution_failed: {
    category: "tool_execution_failed",
    label: "Tool Execution Failure",
    description: "An external tool invocation returned an error or unhandled failure response.",
  },
  language_barrier: {
    category: "language_barrier",
    label: "Language Handling Problem",
    description: "The agent failed to communicate in the required language or miscomprehended linguistic nuances.",
  },
  premature_end: {
    category: "premature_end",
    label: "Premature Termination",
    description: "The agent abruptly terminated the call before the customer's inquiry or flow was completed.",
  },
  excessive_turns: {
    category: "excessive_turns",
    label: "Excessive or Inefficient Conversation",
    description: "The conversation exceeded reasonable turn thresholds without reaching a resolution.",
  },
  contradictory_response: {
    category: "contradictory_response",
    label: "Contradictory Responses",
    description: "The agent made conflicting or self-contradicting statements across different turns of the conversation.",
  },
  insufficient_evidence: {
    category: "insufficient_evidence",
    label: "Insufficient Transcript Evidence",
    description: "The evaluation failed remotely, but the available transcript contains insufficient detail to isolate a specific behavioral fault.",
  },
};

