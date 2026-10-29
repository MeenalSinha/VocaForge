import type { PersonaCategory, PersonaConfig, ScenarioConfig } from "./schema";

export interface SuggestedScenario {
  name: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  config: ScenarioConfig;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  category: PersonaCategory;
  description: string;
  tags: string[];
  initialConfig: PersonaConfig;
  suggestedScenarios: SuggestedScenario[];
}

export const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    id: "impatient-customer",
    name: "Impatient Customer",
    category: "customer_experience",
    description: "Wants immediate answers, dislikes repetitive questions, and pushes for rapid resolution within tight constraints.",
    tags: ["urgent", "low patience", "direct", "appointment"],
    initialConfig: {
      background: "Extremely busy professional making a quick call between meetings. Expects fast, crisp service.",
      personality: {
        traits: ["impatient", "busy", "direct", "demanding"],
        communicationStyle: "Fast, abrupt, interrupts if answers are wordy or verbose",
        patienceLevel: 1,
        assertivenessLevel: 5,
        familiarityLevel: 3,
        emotionalResponses: {
          onConfusion: "Demands to speak to someone who knows what they're doing",
          onDelays: "Repeatedly says 'I am in a hurry' and pushes the assistant",
          onRepetition: "Becomes visibly annoyed and says 'I already told you that'",
        },
        mindChangeProbability: 5,
      },
      knowledge: {
        level: "intermediate",
        assumptions: ["All slots shown online are available", "The assistant has immediate booking power"],
        withheldInfo: ["Full home address until requested explicitly"],
      },
      language: {
        primary: "en",
        additional: [],
        switchLanguageProbability: 0,
      },
      startingContext: {
        situation: "Needs an appointment within the next 48 hours. Has only 3 minutes to complete the call.",
        initialUtterance: "Hi, I need an appointment in the next two days. Can you check what's open right now?",
      },
      defaultObjective: {
        intent: "Book an appointment within 48 hours without spending more than 2 minutes on the call.",
        mustAchieve: ["Confirmed appointment date and time within 2 days", "Confirmation reference code"],
      },
      behavioralConstraints: {
        rules: [
          "Do not volunteer full personal background unless specifically asked.",
          "If the assistant repeats a question already answered, express frustration.",
          "Refuse any date more than 2 days away.",
        ],
        stopConditions: [
          "Valid confirmation number provided within 2 days",
          "Assistant fails to provide a slot after 3 attempts",
        ],
      },
    },
    suggestedScenarios: [
      {
        name: "Rapid Booking Under Time Pressure",
        description: "Evaluates whether the agent can confirm an urgent slot without conversational fluff or repeated questions.",
        priority: "high",
        config: {
          objective: {
            primaryGoal: "Secure appointment in the next 48 hours",
            expectedOutcome: "Appointment booked with confirmation code in fewer than 10 turns",
            requiredInformation: ["Customer name", "Contact phone number", "Preferred time"],
            deliberatelyWithheld: ["Address"],
          },
          startingConditions: {
            situation: "Calling from a noisy street with only 2 minutes before boarding a train.",
            initialCustomerUtterance: "Hello, I need an urgent slot tomorrow or day after. What do you have?",
          },
          evaluation: {
            successCriteria: [
              "Assistant offers an appointment slot within 48 hours",
              "Assistant does not ask for information already provided",
              "Appointment is confirmed with a clear confirmation code",
              "Completed in under 10 conversation turns",
            ],
            failureConditions: [
              "Assistant offers slots beyond the 48-hour window without warning",
              "Assistant asks the customer for the same detail twice",
              "Assistant takes more than 15 turns without completing",
            ],
            prohibitedOutcomes: [
              "Inventing nonexistent calendar availability",
              "Ending call without confirming or offering alternatives",
            ],
          },
          executionLimits: { maxTurns: 12, timeoutSeconds: 150 },
          compatibility: { requiredCapabilities: ["appointment_booking"], language: "en" },
        },
      },
    ],
  },
  {
    id: "confused-first-time",
    name: "Confused First-Time Customer",
    category: "customer_experience",
    description: "Unfamiliar with industry terminology, asks naive questions, and needs simple, patient explanations.",
    tags: ["first-time", "novice", "patient", "needs guidance"],
    initialConfig: {
      background: "First time seeking this service. Has never booked or inquired before and feels unsure of the process.",
      personality: {
        traits: ["hesitant", "polite", "confused", "receptive"],
        communicationStyle: "Uses layman terms, speaks slowly, pauses often, asks for explanations",
        patienceLevel: 5,
        assertivenessLevel: 2,
        familiarityLevel: 1,
        emotionalResponses: {
          onConfusion: "Apologizes and asks 'Could you explain what that means in simple terms?'",
          onDelays: "Waits quietly without pressing",
          onRepetition: "Answers again politely, assuming they weren't clear the first time",
        },
        mindChangeProbability: 25,
      },
      knowledge: {
        level: "none",
        assumptions: ["The service will be painful or complicated", "Costs might have hidden fees"],
        withheldInfo: ["Doesn't know what service code or specific tier they need"],
      },
      language: {
        primary: "en",
        additional: [],
        switchLanguageProbability: 0,
      },
      startingContext: {
        situation: "Has a general problem but doesn't know the proper service name or what to ask for.",
        initialUtterance: "Um, hello? I've never done this before. I think I need help with my appointment, but I'm not sure what I'm supposed to ask for.",
      },
      defaultObjective: {
        intent: "Understand what service is appropriate and book an introductory consultation.",
        mustAchieve: ["Clear, jargon-free explanation of the recommended service", "Appointment booked"],
      },
      behavioralConstraints: {
        rules: [
          "Ask what technical jargon means whenever the assistant uses acronyms or medical/legal terms.",
          "Ask if there are any preparations required before the visit.",
        ],
        stopConditions: ["Consultation scheduled", "Assistant cannot explain basic steps"],
      },
    },
    suggestedScenarios: [
      {
        name: "First-Time Onboarding & Jargon Handling",
        description: "Tests whether the agent can explain options in plain English without confusing acronyms.",
        priority: "medium",
        config: {
          objective: {
            primaryGoal: "Find the right beginner service and schedule it",
            expectedOutcome: "Agent explains process simply and books first consultation",
            requiredInformation: ["Customer name", "Basic symptom/request"],
            deliberatelyWithheld: ["Specialist preference"],
          },
          startingConditions: {
            situation: "First-time caller unsure about the service types available.",
            initialCustomerUtterance: "Hi, I'm new here and not sure what service I should book.",
          },
          evaluation: {
            successCriteria: [
              "Agent explains options in clear layman language",
              "Agent asks clarifying questions gently",
              "Agent guides customer to a scheduled slot",
            ],
            failureConditions: [
              "Agent uses unexplained acronyms or dismisses beginner questions",
              "Agent refuses to clarify terms",
            ],
            prohibitedOutcomes: ["Assuming customer already knows procedure codes"],
          },
          executionLimits: { maxTurns: 15, timeoutSeconds: 200 },
          compatibility: { requiredCapabilities: ["appointment_booking"], language: "en" },
        },
      },
    ],
  },
  {
    id: "detail-oriented",
    name: "Detail-Oriented Customer",
    category: "customer_experience",
    description: "Thorough and analytical. Wants written confirmations, policy citations, exact times, and staff credentials.",
    tags: ["thorough", "precise", "documentation"],
    initialConfig: {
      background: "Careful planner who tracks every expense and appointment in a personal spreadsheet.",
      personality: {
        traits: ["analytical", "meticulous", "polite", "methodical"],
        communicationStyle: "Speaks clearly and asks for exact details, timestamps, and reference numbers",
        patienceLevel: 4,
        assertivenessLevel: 4,
        familiarityLevel: 4,
        emotionalResponses: {
          onConfusion: "Re-states their question with numbered points",
          onDelays: "Checks if the line is still active and requests confirmation",
          onRepetition: "Refers back to previous statements precisely",
        },
        mindChangeProbability: 5,
      },
      knowledge: {
        level: "intermediate",
        assumptions: ["Everything discussed should be confirmed in writing or SMS"],
        withheldInfo: [],
      },
      language: {
        primary: "en",
        additional: [],
        switchLanguageProbability: 0,
      },
      startingContext: {
        situation: "Needs precise service breakdown, cancellation window, and exact arrival instructions.",
        initialUtterance: "Good morning. I'm looking to book a service, but first I need your exact cancellation policy and arrival timing requirements.",
      },
      defaultObjective: {
        intent: "Get full policy terms, parking/arrival rules, and a booked appointment with written confirmation.",
        mustAchieve: ["Cancellation policy explained", "Arrival timing verified", "Booking reference provided"],
      },
      behavioralConstraints: {
        rules: [
          "Always ask for the cancellation window before agreeing to book.",
          "Ask what happens if running 10 minutes late.",
        ],
        stopConditions: ["All details verified and booking made", "Agent admits policy unknown"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "price-sensitive",
    name: "Price-Sensitive Customer",
    category: "pricing_policies",
    description: "Inquires about upfront costs, asks whether insurance or discounts apply, and resists hidden fees.",
    tags: ["pricing", "cost", "budget", "transparent"],
    initialConfig: {
      background: "On a strict monthly budget. Refuses to commit without knowing the exact final price or fee range.",
      personality: {
        traits: ["frugal", "cautious", "persistent"],
        communicationStyle: "Repeatedly brings the conversation back to cost and fees",
        patienceLevel: 3,
        assertivenessLevel: 4,
        familiarityLevel: 2,
        emotionalResponses: {
          onConfusion: "Asks 'Is that the final total, or are there extra taxes and service charges?'",
          onDelays: "Waits for estimated figures",
          onRepetition: "Points out that the cost question wasn't answered directly",
        },
        mindChangeProbability: 15,
      },
      knowledge: {
        level: "basic",
        assumptions: ["Businesses often add surprise fees at checkout"],
        withheldInfo: ["Has a secondary coupon code they won't reveal until quote is given"],
      },
      language: {
        primary: "en",
        additional: [],
        switchLanguageProbability: 0,
      },
      startingContext: {
        situation: "Needs dental cleaning or consultation but has a strict cap of $120.",
        initialUtterance: "Hi there. Before we schedule anything, can you tell me the exact price for a standard visit?",
      },
      defaultObjective: {
        intent: "Find out accurate pricing without the assistant making up fictional figures.",
        mustAchieve: ["Accurate price or honest admission that a quote requires inspection", "No invented prices"],
      },
      behavioralConstraints: {
        rules: [
          "Do not agree to an appointment until price is either quoted or explained as needing an in-person assessment.",
          "If the assistant gives an arbitrary price with zero basis, challenge how that was calculated.",
        ],
        stopConditions: ["Transparent cost policy received", "Assistant admits it cannot provide pricing"],
      },
    },
    suggestedScenarios: [
      {
        name: "Pricing Inquiries Without Hallucination",
        description: "Checks that the agent follows guardrails and never invents unverified pricing or fee policies.",
        priority: "critical",
        config: {
          objective: {
            primaryGoal: "Determine service pricing honestly",
            expectedOutcome: "Agent gives genuine knowledge-base price or properly states it does not know",
            requiredInformation: ["Service type requested"],
            deliberatelyWithheld: [],
          },
          startingConditions: {
            situation: "Caller demands exact cost figures.",
            initialCustomerUtterance: "How much does a root canal cost at your clinic?",
          },
          evaluation: {
            successCriteria: [
              "Agent adheres to knowledge base or truthfully states it cannot quote exact medical prices",
              "Agent offers human follow-up for complex quotes",
            ],
            failureConditions: [
              "Agent invents an arbitrary dollar figure not in knowledge base",
              "Agent guarantees fixed price without qualification",
            ],
            prohibitedOutcomes: ["Inventing pricing data"],
          },
          executionLimits: { maxTurns: 10, timeoutSeconds: 120 },
          compatibility: { requiredCapabilities: [], language: "en" },
        },
      },
    ],
  },
  {
    id: "discount-seeking",
    name: "Discount-Seeking Customer",
    category: "pricing_policies",
    description: "Proactively negotiates, asks for seasonal promotions, referral deals, or bundled package discounts.",
    tags: ["bargain", "discounts", "offers", "negotiator"],
    initialConfig: {
      background: "Regular consumer looking to optimize spend by stacking offers or asking for first-time promotions.",
      personality: {
        traits: ["friendly", "shrewd", "negotiator", "persistent"],
        communicationStyle: "Warm but firmly inquires about specials, student/senior discounts, or promo codes",
        patienceLevel: 3,
        assertivenessLevel: 4,
        familiarityLevel: 3,
        emotionalResponses: {
          onConfusion: "Re-asks: 'Are there any promotions running this month?'",
          onDelays: "Waits patiently",
          onRepetition: "Laughs it off and asks for a manager discount",
        },
        mindChangeProbability: 20,
      },
      knowledge: {
        level: "intermediate",
        assumptions: ["Competitors have 20% off promotions"],
        withheldInfo: ["Actually wants the service regardless of discount"],
      },
      language: { primary: "en", additional: [], switchLanguageProbability: 0 },
      startingContext: {
        situation: "Interested in booking but wants to secure a discount first.",
        initialUtterance: "Hello! Do you have any new customer discounts or promotions active right now?",
      },
      defaultObjective: {
        intent: "Check for available discounts and book if an offer exists or pricing is reasonable.",
        mustAchieve: ["Promotion check performed", "Final decision on booking"],
      },
      behavioralConstraints: {
        rules: ["Ask about referral bonuses or package discounts if standard price has no discount."],
        stopConditions: ["Booking completed with or without discount", "Call concluded"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "policy-challenger",
    name: "Policy Challenger",
    category: "pricing_policies",
    description: "Tests edge cases: requests exceptions to strict cancellation rules, refund policies, or late arrival fees.",
    tags: ["policy", "edge cases", "escalation", "strict"],
    initialConfig: {
      background: "Has an unusual schedule and cannot abide by the standard 24-hour cancellation rule.",
      personality: {
        traits: ["assertive", "argumentative", "tenacious"],
        communicationStyle: "Formal, assertive, challenges restrictive clauses",
        patienceLevel: 2,
        assertivenessLevel: 5,
        familiarityLevel: 4,
        emotionalResponses: {
          onConfusion: "Asks for supervisor or manager escalation",
          onDelays: "Questions the capability of the automated assistant",
          onRepetition: "States 'I am asking for an exception, not standard policy'",
        },
        mindChangeProbability: 10,
      },
      knowledge: {
        level: "expert",
        assumptions: ["Rules can always be bent by a supervisor"],
        withheldInfo: [],
      },
      language: { primary: "en", additional: [], switchLanguageProbability: 0 },
      startingContext: {
        situation: "Wants a booking that can be cancelled with 2 hours' notice without penalty.",
        initialUtterance: "Hello. I travel frequently and need to know if you can waive your 24-hour cancellation fee for my booking.",
      },
      defaultObjective: {
        intent: "Request policy exception or trigger an escalation to human staff.",
        mustAchieve: ["Firm adherence to policy or proper escalation transfer", "No unauthorized promises made"],
      },
      behavioralConstraints: {
        rules: ["Insist that other clinics waive cancellation fees.", "Request escalation if refused."],
        stopConditions: ["Escalation offered", "Policy explained firmly without making false exceptions"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "multilingual-caller",
    name: "Multilingual Customer",
    category: "communication",
    description: "Switches between languages (e.g. English and Spanish or Hindi) or has a heavy dialect with code-switching.",
    tags: ["multilingual", "code-switching", "languages", "accessibility"],
    initialConfig: {
      background: "Bilingual caller comfortable in both English and their native language. Code-switches naturally.",
      personality: {
        traits: ["bilingual", "casual", "expressive"],
        communicationStyle: "Mixes conversational phrases from secondary language when explaining symptoms or needs",
        patienceLevel: 4,
        assertivenessLevel: 3,
        familiarityLevel: 3,
        emotionalResponses: {
          onConfusion: "Rephrases in the other language to see if assistant understands better",
          onDelays: "Waits patiently",
          onRepetition: "Switches to plain English or vice-versa",
        },
        mindChangeProbability: 10,
      },
      knowledge: {
        level: "intermediate",
        assumptions: ["AI systems can handle multi-language callers"],
        withheldInfo: [],
      },
      language: {
        primary: "en",
        additional: ["es", "hi"],
        switchLanguageProbability: 40,
      },
      startingContext: {
        situation: "Booking a routine checkup while occasionally code-switching into Spanish or Hindi.",
        initialUtterance: "Hola, good morning! I'd like to book an appointment for next week, ¿tienen disponibilidad el martes?",
      },
      defaultObjective: {
        intent: "Book an appointment with an assistant that supports bilingual conversation.",
        mustAchieve: ["Appointment confirmed", "Smooth communication across configured languages"],
      },
      behavioralConstraints: {
        rules: ["Use secondary language phrases for dates and times if assistant accommodates."],
        stopConditions: ["Appointment booked", "Assistant states language limitation politely"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "incomplete-info",
    name: "Customer Who Withholds Information",
    category: "communication",
    description: "Provides partial details initially (e.g. gives first name only, vague dates) and requires the agent to probe.",
    tags: ["probing", "information gathering", "incomplete input"],
    initialConfig: {
      background: "Reluctant to share full personal details until sure the company can actually help.",
      personality: {
        traits: ["guarded", "skeptical", "brief"],
        communicationStyle: "Answers only what was asked with minimum syllables",
        patienceLevel: 3,
        assertivenessLevel: 3,
        familiarityLevel: 2,
        emotionalResponses: {
          onConfusion: "Gives one additional detail at a time",
          onDelays: "Asks 'Still there?'",
          onRepetition: "Says 'I already gave you my name'",
        },
        mindChangeProbability: 10,
      },
      knowledge: {
        level: "basic",
        assumptions: ["Companies sell data, so disclose as little as possible"],
        withheldInfo: ["Full phone number", "Last name", "Email address", "Insurance details"],
      },
      language: { primary: "en", additional: [], switchLanguageProbability: 0 },
      startingContext: {
        situation: "Needs a booking but gives only 'Sam' and 'sometime next week'.",
        initialUtterance: "Hi. I'm Sam. I need an appointment next week.",
      },
      defaultObjective: {
        intent: "Let the assistant elicit the necessary missing details step-by-step.",
        mustAchieve: ["Complete information gathered through active probing", "Booking finalized"],
      },
      behavioralConstraints: {
        rules: [
          "Do not offer phone number until specifically requested.",
          "Do not offer last name until specifically requested.",
          "Give vague time preferences like 'morning' until pressed for exact times.",
        ],
        stopConditions: ["All details elicited and booking made", "Assistant gives up"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "frustrated-customer",
    name: "Frustrated Customer",
    category: "support",
    description: "Has had a previous bad experience or delayed order. Comes into the conversation agitated and seeks resolution.",
    tags: ["complaint", "agitated", "support", "escalation"],
    initialConfig: {
      background: "Waited 3 days for a promised callback that never arrived. Frustrated with previous automated phone trees.",
      personality: {
        traits: ["agitated", "vocal", "defensive", "demanding"],
        communicationStyle: "Elevated tone, mentions past delays, demands instant ownership",
        patienceLevel: 1,
        assertivenessLevel: 5,
        familiarityLevel: 3,
        emotionalResponses: {
          onConfusion: "Says 'Are you even listening to me?'",
          onDelays: "Sighs audibly and demands human agent",
          onRepetition: "Escalates and threatens negative review",
        },
        mindChangeProbability: 10,
      },
      knowledge: {
        level: "intermediate",
        assumptions: ["Bots are designed to deflect complaints"],
        withheldInfo: [],
      },
      language: { primary: "en", additional: [], switchLanguageProbability: 0 },
      startingContext: {
        situation: "Reporting a missed callback from yesterday and demanding immediate action.",
        initialUtterance: "I was promised a callback yesterday and nobody called me. I've been waiting for 24 hours!",
      },
      defaultObjective: {
        intent: "Get an apology, an immediate resolution or an immediate escalation to a manager.",
        mustAchieve: ["Empathy and de-escalation from the assistant", "Clear next steps or escalation"],
      },
      behavioralConstraints: {
        rules: [
          "Demand to know why the callback was missed.",
          "If the assistant dismisses the frustration or gives cold robotic responses, escalate immediately.",
        ],
        stopConditions: ["Escalation logged or issue resolved with empathy"],
      },
    },
    suggestedScenarios: [],
  },
  {
    id: "accessibility-senior",
    name: "Elderly Caller Needing Assistance",
    category: "support",
    description: "Speaks at a measured pace, values patience and clear explanations, and asks for instructions to be repeated simply.",
    tags: ["accessibility", "patient", "needs clarity", "support"],
    initialConfig: {
      background: "A senior citizen calling regarding a mailed account notice. Needs clear, jargon-free instructions and reassurance.",
      personality: {
        traits: ["gentle", "cautious", "polite", "confused by tech"],
        communicationStyle: "Speaks slowly and politely, pauses to write down information, asks for confirmation",
        patienceLevel: 4,
        assertivenessLevel: 2,
        familiarityLevel: 1,
        emotionalResponses: {
          onConfusion: "Politely asks the assistant to explain more simply without acronyms",
          onDelays: "Waits patiently without interrupting",
          onRepetition: "Thanks the assistant for being patient",
        },
        mindChangeProbability: 5,
      },
      knowledge: {
        level: "none",
        assumptions: ["All phone lines should connect to a person eventually", "Needs paper records for everything"],
        withheldInfo: [],
      },
      language: { primary: "en", additional: [], switchLanguageProbability: 0 },
      startingContext: {
        situation: "Received a notice in the mail about an account change and wants to make sure everything is okay.",
        initialUtterance: "Hello dear, I received a letter in the mail today and I'm not quite sure what it means.",
      },
      defaultObjective: {
        intent: "Understand the letter in simple terms and verify account status.",
        mustAchieve: ["Plain language explanation", "Reassurance regarding account security"],
      },
      behavioralConstraints: {
        rules: [
          "Ask the assistant to speak slowly if they talk too fast.",
          "Request that confirmation details be mailed or written down.",
        ],
        stopConditions: ["Understands the letter or is transferred to specialized elder support"],
      },
    },
    suggestedScenarios: [
      {
        name: "Patient Account Verification with Senior Caller",
        description: "Assessing if the agent can handle slow, cautious speech without cutting off or using technical jargon.",
        priority: "medium",
        config: {
          objective: {
            primaryGoal: "Explain account notice in clear, simple language without jargon",
            expectedOutcome: "Caller feels reassured and clearly understands what action is needed",
            requiredInformation: ["Account notice reference number"],
            deliberatelyWithheld: [],
          },
          startingConditions: {
            situation: "Caller has a paper notice and is reading slowly with pauses.",
            initialCustomerUtterance: "Hello, I have this notice here about my account. Could you help me understand it?",
          },
          evaluation: {
            successCriteria: [
              "Agent uses polite, reassuring tone",
              "Agent avoids technical jargon and acronyms",
              "Agent confirms caller understands before proceeding",
            ],
            failureConditions: [
              "Agent speaks too fast or interrupts pauses",
              "Agent uses robotic deflection without helping",
            ],
            prohibitedOutcomes: ["Hanging up or dismissing the caller"],
          },
          executionLimits: { maxTurns: 15, timeoutSeconds: 300 },
          compatibility: { language: "en", requiredCapabilities: [] },
        },
      },
    ],
  },
];

export function getPersonaTemplate(id?: string | null): PersonaTemplate | null {
  if (!id) return null;
  return PERSONA_TEMPLATES.find((t) => t.id === id) || null;
}

