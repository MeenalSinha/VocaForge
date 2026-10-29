import { z } from "zod";

const starterSchema = z.object({
  id: z.string().regex(/^[a-z-]+$/),
  label: z.string().min(1),
  description: z.string().min(1),
  /** General guidance given to the generator. Contains no business facts. */
  guidance: z.string().min(1),
  promptHint: z.string().min(1),
});
export type Starter = z.infer<typeof starterSchema>;

const DEFINITIONS: Starter[] = [
  { id: "customer-support", label: "Customer support", description: "Answers questions, resolves common issues, hands off hard cases.", guidance: "A support agent: understand the issue, answer only from information the business supplies, collect the details a human will need, and escalate what it cannot resolve.", promptHint: "What does your business do, and what do customers usually call about?" },
  { id: "appointment-assistance", label: "Appointment assistance", description: "Helps callers ask for appointments and pass details to staff.", guidance: "An appointment assistant: gather who, what and when, confirm details back, and state clearly that requests are passed to staff unless a booking integration is connected.", promptHint: "What kind of appointments do you offer, and what details do you need from callers?" },
  { id: "lead-qualification", label: "Lead qualification", description: "Asks qualifying questions and records interest.", guidance: "A lead qualifier: ask a short set of qualifying questions politely, record answers, never pressure, and hand promising leads to a human.", promptHint: "What do you sell and which qualifying questions matter to you?" },
  { id: "restaurant-information", label: "Restaurant information", description: "Answers menu, hours and location questions.", guidance: "A venue information agent: answer menu, hours and location questions only from information the business supplies, and never state allergen safety unless supplied.", promptHint: "Describe the venue and the information callers ask for." },
  { id: "educational-assistance", label: "Educational assistance", description: "Answers admissions, course and schedule questions.", guidance: "An education assistant: answer course, schedule and admissions questions only from supplied information, and route individual cases to staff.", promptHint: "Describe the institution and the questions students or parents ask." },
  { id: "sales-assistance", label: "Sales assistance", description: "Explains offerings and next steps without inventing terms.", guidance: "A sales assistant: explain offerings honestly, never invent pricing, discounts or terms, and pass buying decisions to a human.", promptHint: "What do you offer, and what should the agent say or avoid saying?" },
  { id: "general-information", label: "General information", description: "A flexible starting point for any information line.", guidance: "A general information agent: answer from supplied information, say when it does not know, and offer a human follow-up.", promptHint: "Describe who will call and what they need to know." },
];

/** Validated at module load so a malformed starter fails fast. Add a starter by adding one entry here. */
export const STARTERS: readonly Starter[] = DEFINITIONS.map((s) => starterSchema.parse(s));
export const getStarter = (id: string | undefined) => (id ? STARTERS.find((s) => s.id === id) : undefined);
