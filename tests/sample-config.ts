import { agentConfigSchema } from "@/server/agents/config-schema";

export const sampleConfig = () =>
  agentConfigSchema.parse({
    identity: { name: "Desk", description: "", role: "A front desk assistant." },
    behavior: {
      purpose: "Answer calls.",
      goals: ["Answer questions"],
      welcomeMessage: "Hello, how can I help?",
      instructions: "Be brief.",
      tone: "warm",
      responseStyle: "",
    },
    knowledge: { sources: ["Owner supplied notes"], mustNotInvent: ["prices"] },
    guardrails: {
      prohibitedActions: ["Give medical advice"],
      restrictedInformation: [],
      escalationConditions: ["Caller reports an emergency"],
      uncertaintyRules: "",
    },
    language: { primary: "en", additional: ["hi"] },
    voice: {},
    capabilities: [{ name: "Book appointments", description: "", status: "unavailable", note: "" }],
  });
