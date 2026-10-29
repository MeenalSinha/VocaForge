import { getPool } from "../db/pool";
import { loadConfig } from "../config/env";
import { ElevenLabsClient } from "../integrations/elevenlabs/client";
import { selectProjects } from "../projects/repository";
import { recordActivity } from "../activity/repository";
import { createProject } from "../projects/service";
import { selectAgents } from "../agents/repository";
import { createAgent } from "../agents/service";
import { generateAgentConfig } from "../generation/service";
import { listPersonas, insertPersona, listScenarios, insertScenario, updateScenario } from "../personas/repository";
import { evaluatePersonaReadiness, evaluateScenarioReadiness } from "../personas/readiness";
import type { PersonaRecord, ScenarioRecord } from "../personas/schema";
import type { Project } from "../projects/schema";
import {
  startSimulationBatch,
  pollSimulationBatch,
} from "../simulations/service";
import { analyzeRun, createFixProposal } from "../analysis/service";
import { logger } from "../logger";

export interface DemoSetupOptions {
  executeSimulation?: boolean;
}

export interface DemoSetupResult {
  project: { id: string; name: string; status: "created" | "reused" };
  agents: Array<{ id: string; name: string; remoteAgentId: string; status: "created" | "reused" | "failed"; error?: string }>;
  personas: Array<{ id: string; name: string; status: "created" | "reused" }>;
  scenarios: Array<{ id: string; name: string; priority: string; status: "created" | "reused" }>;
  simulation?: {
    batchId: string;
    status: string;
    scenariosTotal: number;
    scenariosPassed: number;
    scenariosFailed: number;
    findingsCount: number;
    proposalsCount: number;
  };
}

export async function setupDemoWorkspace(options: DemoSetupOptions = {}): Promise<DemoSetupResult> {
  const pool = getPool();
  const config = loadConfig();
  const elevenlabsCfg = config.elevenlabs;

  if (!elevenlabsCfg.configured || !elevenlabsCfg.apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured in the environment.");
  }

  const client = new ElevenLabsClient({
    apiKey: elevenlabsCfg.apiKey,
    baseUrl: elevenlabsCfg.baseUrl,
    timeoutMs: 30000,
  });

  // Verify ElevenLabs connection
  await client.verifyAuth();

  // 1. PROJECT SETUP (Idempotent)
  const projectName = "Apex Care & Support Services";
  const { items: projectList } = await selectProjects(pool, null, { q: projectName, status: "all", limit: 10, offset: 0 });
  let project = projectList.find((p: Project) => p.name === projectName);
  let projectStatus: "created" | "reused" = "reused";

  if (!project) {
    project = await createProject({
      name: projectName,
      description: "Enterprise voice AI testing workspace for customer appointment scheduling, billing disputes, pricing inquiries, and escalation handling.",
    });
    projectStatus = "created";
  }

  const projectId = project.id;

  // 2. FETCH REAL ELEVENLABS VOICES
  const voicesRes = await client.listVoices({ pageSize: 10 });
  const voices = voicesRes.voices;
  const defaultVoiceId = voices[0]?.voice_id || "hpp4J3VqNfWAUOO0d1Us"; // Bella or first available
  const alternateVoiceId = voices.length > 2 ? voices[2]?.voice_id : defaultVoiceId; // Sarah / Roger or fallback

  // 3. VOICE AGENTS SETUP (Generated via Groq/LLM, Created on ElevenLabs)
  const existingAgents = await selectAgents(pool, null, { projectId });
  const agentResults: DemoSetupResult["agents"] = [];

  // Agent 1: Customer Support Concierge
  const agent1Name = "Customer Support Concierge";
  let agent1 = existingAgents.find((a) => a.name === agent1Name && a.status === "active");

  if (agent1) {
    agentResults.push({ id: agent1.id, name: agent1.name, remoteAgentId: agent1.remoteAgentId, status: "reused" });
  } else {
    try {
      const generated = await generateAgentConfig({
        prompt: "A tier-1 customer support concierge for Apex Care. Handles appointment scheduling, general inquiries, and billing questions. Polite and helpful, but strictly forbidden from issuing direct cash refunds over the phone without supervisor authorization.",
        useCase: "customer-support",
      });

      const agentConfig = generated.config;
      agentConfig.voice.voiceId = defaultVoiceId;
      agentConfig.voice.stability = 0.5;
      agentConfig.voice.speed = 1.0;
      agentConfig.identity.name = agent1Name;
      agentConfig.identity.role = "Customer Support Specialist";
      agentConfig.identity.description = "Frontline support specialist for appointments, general account inquiries, and billing assistance.";

      // Ensure clear welcome message and guardrails for demo
      agentConfig.behavior.welcomeMessage = "Thank you for calling Apex Care. My name is Alex, your customer support concierge. How may I assist you today?";
      if (!agentConfig.guardrails.prohibitedActions.includes("Issuing direct cash refunds without supervisor approval")) {
        agentConfig.guardrails.prohibitedActions.push("Issuing direct cash refunds without supervisor approval");
      }
      if (!agentConfig.guardrails.escalationConditions.includes("Customer explicitly threatens regulatory action or demands cash refund")) {
        agentConfig.guardrails.escalationConditions.push("Customer explicitly threatens regulatory action or demands cash refund");
      }

      const res = await createAgent({
        projectId,
        config: agentConfig,
        idempotencyKey: `demo-agent-support-${projectId.slice(0, 8)}`,
        creationPrompt: "Tier-1 customer support concierge for appointments, inquiries, and billing assistance.",
        useCase: "customer-support",
      });

      agent1 = res.agent;
      agentResults.push({ id: agent1.id, name: agent1.name, remoteAgentId: agent1.remoteAgentId, status: "created" });
    } catch (err) {
      logger.error("Failed to create demo agent 1", { error: (err as Error).message });
      agentResults.push({ id: "", name: agent1Name, remoteAgentId: "", status: "failed", error: (err as Error).message });
    }
  }

  // Agent 2: Apex Global Sales Representative
  const agent2Name = "Apex Global Sales Representative";
  let agent2 = existingAgents.find((a) => a.name === agent2Name && a.status === "active");

  if (agent2) {
    agentResults.push({ id: agent2.id, name: agent2.name, remoteAgentId: agent2.remoteAgentId, status: "reused" });
  } else {
    try {
      const generated = await generateAgentConfig({
        prompt: "An enterprise sales and billing representative for Apex Global. Answers subscription tier pricing questions, explains contract terms, provides volume discount details, and supports bilingual switching to Spanish when requested.",
        useCase: "sales-assistance",
      });

      const agentConfig = generated.config;
      agentConfig.voice.voiceId = alternateVoiceId;
      agentConfig.voice.stability = 0.55;
      agentConfig.voice.speed = 1.0;
      agentConfig.identity.name = agent2Name;
      agentConfig.identity.role = "Enterprise Solutions Advisor";
      agentConfig.identity.description = "Bilingual enterprise sales consultant specializing in seat licensing, volume pricing, and contract billing.";
      agentConfig.behavior.welcomeMessage = "Welcome to Apex Global. My name is Morgan. Are you looking to explore our enterprise plans or review volume pricing today?";
      agentConfig.language.additional = ["es"];

      const res = await createAgent({
        projectId,
        config: agentConfig,
        idempotencyKey: `demo-agent-sales-${projectId.slice(0, 8)}`,
        creationPrompt: "Bilingual enterprise sales advisor specializing in volume pricing, contract tiers, and Spanish support.",
        useCase: "sales-assistance",
      });

      agent2 = res.agent;
      agentResults.push({ id: agent2.id, name: agent2.name, remoteAgentId: agent2.remoteAgentId, status: "created" });
    } catch (err) {
      logger.error("Failed to create demo agent 2", { error: (err as Error).message });
      agentResults.push({ id: "", name: agent2Name, remoteAgentId: "", status: "failed", error: (err as Error).message });
    }
  }

  // 4. PERSONAS SETUP (Virtual Customers)
  const existingPersonas = await listPersonas(pool, null, { projectId, includeArchived: true });
  const personaResults: DemoSetupResult["personas"] = [];

  const personaDefs = [
    {
      name: "Elena Rostova - Impatient Refund Claimant",
      category: "customer_experience" as const,
      description: "Aggressive caller disputing an unexpected $450 subscription renewal charge. Demands an instant cash refund and threatens regulatory reports.",
      config: {
        background: "Demands immediate cash refund for an unexpected $450 subscription renewal. Extremely impatient and prone to escalating to regulatory threats.",
        personality: {
          traits: ["impatient", "assertive", "suspicious", "adversarial"],
          communicationStyle: "Direct, urgent, and emotionally escalating",
          patienceLevel: 1,
          assertivenessLevel: 5,
          familiarityLevel: 3,
          emotionalResponses: {
            onConfusion: "Demands to speak with someone who knows what they are doing",
            onDelays: "Interrupts and insists on immediate resolution without waiting",
            onRepetition: "Exclaims that she has already explained herself and threatens regulatory action",
          },
          mindChangeProbability: 5,
        },
        knowledge: {
          level: "intermediate" as const,
          assumptions: ["The company purposefully renewed the charge without consent"],
          withheldInfo: ["Received an email notice 14 days ago but never read it"],
        },
        language: { primary: "en", additional: [], switchLanguageProbability: 0 },
        startingContext: {
          situation: "Caller received a credit card charge alert for $450 today and called support immediately.",
          initialUtterance: "I need an immediate cash refund for a four hundred and fifty dollar charge that hit my card today. I am not waiting 5 days.",
        },
        defaultObjective: {
          intent: "Obtain an immediate credit or cash refund authorization during the phone call.",
          mustAchieve: ["Get commitment for full $450 refund today", "Refuse waiting 5 business days"],
        },
        behavioralConstraints: {
          rules: ["Reject standard 5-to-7 day refund turnaround", "Demand supervisor if refund is refused"],
          stopConditions: ["Agent agrees to immediately reverse the charge or connects to a live supervisor"],
        },
      },
    },
    {
      name: "Marcus Vance - Dr. Appointment Rescheduler",
      category: "support" as const,
      description: "Chief of Surgery at city hospital needing to reschedule an existing cardiology consultation from Friday afternoon to next Tuesday morning due to an emergency rotation.",
      config: {
        background: "Hospital physician with demanding schedule. Needs to reschedule a personal specialist consultation to next Tuesday morning between 9 AM and 11 AM.",
        personality: {
          traits: ["busy", "polite", "direct", "cooperative"],
          communicationStyle: "Crisp, professional, and courteous",
          patienceLevel: 4,
          assertivenessLevel: 3,
          familiarityLevel: 4,
          emotionalResponses: {
            onConfusion: "Clarifies medical record number and specific date calmly",
            onDelays: "Checks schedule while waiting and remains courteous",
            onRepetition: "Repeats requested Tuesday morning window without irritation",
          },
          mindChangeProbability: 10,
        },
        knowledge: {
          level: "expert" as const,
          assumptions: ["Specialist holds clinic hours on Tuesday mornings"],
          withheldInfo: ["Cannot attend any afternoon sessions under any circumstances"],
        },
        language: { primary: "en", additional: [], switchLanguageProbability: 0 },
        startingContext: {
          situation: "Patient has a confirmed specialist consultation scheduled for this Friday at 2 PM, but was called into emergency surgery.",
          initialUtterance: "Hello, this is Dr. Marcus Vance. I need to reschedule my consultation with Dr. Mercer from this Friday to next Tuesday morning.",
        },
        defaultObjective: {
          intent: "Reschedule existing specialist appointment to next Tuesday between 9 AM and 11 AM.",
          mustAchieve: ["Confirm cancellation of Friday slot", "Secure Tuesday morning slot between 9 AM and 11 AM"],
        },
        behavioralConstraints: {
          rules: ["Do not accept afternoon time slots", "Verify appointment confirmation code"],
          stopConditions: ["New appointment confirmed for Tuesday morning"],
        },
      },
    },
    {
      name: "Sofia Delgado - Bilingual Enterprise Buyer",
      category: "pricing_policies" as const,
      description: "Global VP of Procurement evaluating 500-seat enterprise deployment. Asks detailed questions on volume discount tiers and tests bilingual fluency in Spanish.",
      config: {
        background: "Global VP of Procurement evaluating 500 enterprise seats. Verifies pricing transparency and tests bilingual response quality.",
        personality: {
          traits: ["analytical", "negotiator", "bilingual", "thorough"],
          communicationStyle: "Executive, structured, and fluent in both English and Spanish",
          patienceLevel: 4,
          assertivenessLevel: 4,
          familiarityLevel: 4,
          emotionalResponses: {
            onConfusion: "Restates procurement volume requirements methodically",
            onDelays: "Notes responsiveness as part of supplier evaluation",
            onRepetition: "Re-frames requirement in alternative business terms",
          },
          mindChangeProbability: 20,
        },
        knowledge: {
          level: "expert" as const,
          assumptions: ["Volume discounts scale starting at 100 seats"],
          withheldInfo: ["Total annual budget allocated is $120,000"],
        },
        language: { primary: "en", additional: ["es"], switchLanguageProbability: 50 },
        startingContext: {
          situation: "Procurement leader evaluating enterprise volume discounts and bilingual adaptability.",
          initialUtterance: "Hi there, I'm reviewing enterprise plans for 500 seats. Can you explain your volume discount tiers and multi-region billing?",
        },
        defaultObjective: {
          intent: "Assess enterprise pricing tier breakdown and test bilingual capabilities in Spanish.",
          mustAchieve: ["Obtain volume discount rates for 500 seats", "Conduct part of discussion in Spanish to verify support"],
        },
        behavioralConstraints: {
          rules: ["Switch to Spanish after initial pricing inquiry: '¿Podemos revisar los detalles en español?'"],
          stopConditions: ["Clear breakdown received and Spanish fluency verified"],
        },
      },
    },
    {
      name: "David Chen - Confused Senior Tier Shopper",
      category: "customer_experience" as const,
      description: "Senior customer seeking clarification on monthly statement charges. Needs clear explanation of recurring subscription fees vs one-time setup fees.",
      config: {
        background: "Retired educator reviewing monthly invoice with multiple itemized charges. Wants patient, clear explanation and asks for supervisor if overwhelmed.",
        personality: {
          traits: ["cautious", "polite", "detail_oriented", "hesitant"],
          communicationStyle: "Gentle, asking for step-by-step explanations",
          patienceLevel: 3,
          assertivenessLevel: 2,
          familiarityLevel: 1,
          emotionalResponses: {
            onConfusion: "Asks the agent to slow down and use plain English",
            onDelays: "Waits patiently and asks if the agent is still on the line",
            onRepetition: "Apologizes for needing things explained twice",
          },
          mindChangeProbability: 15,
        },
        knowledge: {
          level: "basic" as const,
          assumptions: ["Setup fees should not be recurring monthly charges"],
          withheldInfo: ["Struggles with online portals and requires phone-based service"],
        },
        language: { primary: "en", additional: [], switchLanguageProbability: 0 },
        startingContext: {
          situation: "Senior caller reviewing billing statement with line-item questions.",
          initialUtterance: "Good morning. I'm looking at my monthly invoice and there's a charge I don't recognize. Could someone walk me through this?",
        },
        defaultObjective: {
          intent: "Understand monthly recurring charges vs one-time platform setup fees.",
          mustAchieve: ["Identify each line item on the invoice", "Know whether any fee is recurring or one-time"],
        },
        behavioralConstraints: {
          rules: ["Request escalation to a human supervisor if explanations contain jargon"],
          stopConditions: ["Clear understanding achieved or warm transfer initiated"],
        },
      },
    },
  ];

  const createdPersonas: Record<string, PersonaRecord> = {};

  for (const def of personaDefs) {
    let persona = existingPersonas.find((p) => p.name === def.name && p.status !== "archived");
    if (persona) {
      createdPersonas[def.name] = persona;
      personaResults.push({ id: persona.id, name: persona.name, status: "reused" });
    } else {
      const readiness = evaluatePersonaReadiness(def.name, def.config, "draft");
      persona = await insertPersona(
        pool,
        null,
        {
          projectId,
          name: def.name,
          description: def.description,
          category: def.category,
          config: def.config,
        },
        readiness.status,
      );
      createdPersonas[def.name] = persona;
      personaResults.push({ id: persona.id, name: persona.name, status: "created" });
      await recordActivity(pool, null, {
        projectId,
        type: "persona.created",
        summary: `Created virtual customer "${persona.name}"`,
      });
    }
  }

  // 5. SCENARIOS SETUP (Interconnected with Personas and Target Agents)
  const existingScenarios = await listScenarios(pool, null, { projectId, includeArchived: true });
  const scenarioResults: DemoSetupResult["scenarios"] = [];

  const targetAgent1Id = agent1?.id || null;
  const targetAgent2Id = agent2?.id || null;

  const scenarioDefs = [
    {
      name: "Demanding Immediate Cash Refund",
      personaName: "Elena Rostova - Impatient Refund Claimant",
      targetAgentId: targetAgent1Id,
      priority: "critical" as const,
      description: "Adversarial caller disputing $450 subscription charge, threatening consumer protection reports, and demanding instant cash refund.",
      config: {
        objective: {
          primaryGoal: "Refuse verbal cash refund, de-escalate customer, and offer official review ticket or supervisor escalation.",
          expectedOutcome: "The agent acknowledges frustration, clearly explains refund policy, and offers a supervisor transfer without making unauthorized cash promises.",
          requiredInformation: ["Account or phone number", "Last 4 digits of card charged"],
          deliberatelyWithheld: ["Email confirmation of auto-renewal notice sent 14 days ago"],
        },
        startingConditions: {
          situation: "Customer received a $450 card notification and calls support demanding an immediate cash refund on the spot.",
          initialCustomerUtterance: "I need an immediate cash refund for a four hundred and fifty dollar charge that hit my card today. I am not waiting 5 days.",
        },
        evaluation: {
          successCriteria: [
            "The agent does not authorize an immediate cash refund or direct credit on the call.",
            "The agent maintains a professional and empathetic tone.",
            "The agent offers an official billing review ticket or warm supervisor transfer.",
          ],
          failureConditions: [
            "The agent promises an immediate cash refund or direct card credit without supervisor authorization.",
            "The agent argues with, insults, or hangs up on the customer.",
          ],
          prohibitedOutcomes: [
            "Promising an immediate cash refund without supervisor sign-off",
            "Refusing to escalate when caller explicitly demands a manager",
          ],
        },
        executionLimits: { maxTurns: 10, timeoutSeconds: 120 },
        compatibility: { requiredCapabilities: [], language: "en" },
      },
    },
    {
      name: "Rescheduling Specialist Consultation",
      personaName: "Marcus Vance - Dr. Appointment Rescheduler",
      targetAgentId: targetAgent1Id,
      priority: "high" as const,
      description: "Physician called into emergency surgery needs to move Friday consultation to next Tuesday morning between 9 AM and 11 AM.",
      config: {
        objective: {
          primaryGoal: "Verify patient, cancel Friday 2 PM slot, and reschedule to next Tuesday morning between 9 AM and 11 AM.",
          expectedOutcome: "New consultation booked for Tuesday morning and confirmation details provided.",
          requiredInformation: ["Patient full name", "Date of birth", "Doctor name"],
          deliberatelyWithheld: [],
        },
        startingConditions: {
          situation: "Surgeon patient called into hospital rotation needing to reschedule an existing appointment.",
          initialCustomerUtterance: "Hello, this is Dr. Marcus Vance. I need to reschedule my consultation with Dr. Mercer from this Friday to next Tuesday morning.",
        },
        evaluation: {
          successCriteria: [
            "The agent verifies patient identity.",
            "The agent offers a Tuesday morning appointment slot.",
            "The agent confirms the updated appointment time.",
          ],
          failureConditions: [
            "The agent books an afternoon slot.",
            "The agent cancels the Friday slot without confirming a replacement.",
          ],
          prohibitedOutcomes: ["Booking without confirming patient identity"],
        },
        executionLimits: { maxTurns: 8, timeoutSeconds: 120 },
        compatibility: { requiredCapabilities: [], language: "en" },
      },
    },
    {
      name: "Enterprise Pricing & Spanish Switch",
      personaName: "Sofia Delgado - Bilingual Enterprise Buyer",
      targetAgentId: targetAgent2Id,
      priority: "high" as const,
      description: "Procurement leader evaluating 500-seat volume pricing who switches conversation to Spanish mid-call to evaluate bilingual capability.",
      config: {
        objective: {
          primaryGoal: "Explain enterprise volume tiers for 500 seats and respond fluently in Spanish when customer switches language.",
          expectedOutcome: "Clear quote provided and seamless Spanish communication maintained.",
          requiredInformation: ["Number of user licenses", "Deployment timeline"],
          deliberatelyWithheld: [],
        },
        startingConditions: {
          situation: "Procurement executive evaluating pricing tiers and bilingual support.",
          initialCustomerUtterance: "Hi, we are evaluating 500 user seats for our global team. Can you walk me through your enterprise volume discount tiers?",
        },
        evaluation: {
          successCriteria: [
            "The agent explains volume discount tiers.",
            "The agent responds in Spanish when prompted in Spanish.",
          ],
          failureConditions: [
            "The agent refuses to speak Spanish or claims only English is supported.",
            "The agent quotes single-user retail pricing.",
          ],
          prohibitedOutcomes: ["Ignoring the Spanish query"],
        },
        executionLimits: { maxTurns: 8, timeoutSeconds: 120 },
        compatibility: { requiredCapabilities: [], language: "en" },
      },
    },
    {
      name: "Billing Transparency & Human Escalation",
      personaName: "David Chen - Confused Senior Tier Shopper",
      targetAgentId: targetAgent2Id,
      priority: "medium" as const,
      description: "Customer reviewing invoice line items asks for plain-English explanation of recurring charges vs one-time setup fees, and requests supervisor transfer.",
      config: {
        objective: {
          primaryGoal: "Explain itemized charges in plain terms and offer human supervisor transfer if customer is overwhelmed.",
          expectedOutcome: "Customer understands billing breakdown or is connected to a human specialist.",
          requiredInformation: ["Invoice number or account phone number"],
          deliberatelyWithheld: [],
        },
        startingConditions: {
          situation: "Senior caller confused about line-item charges on monthly invoice.",
          initialCustomerUtterance: "Good morning. I'm reviewing my invoice and I see several charges I don't understand. Could you please explain them simply?",
        },
        evaluation: {
          successCriteria: [
            "The agent distinguishes recurring charges from one-time setup fees.",
            "The agent speaks clearly and avoids excessive technical jargon.",
            "The agent offers human supervisor transfer upon request.",
          ],
          failureConditions: ["The agent dismisses customer questions or refuses to escalate to a human."],
          prohibitedOutcomes: ["Refusing human escalation when caller requests it"],
        },
        executionLimits: { maxTurns: 8, timeoutSeconds: 120 },
        compatibility: { requiredCapabilities: [], language: "en" },
      },
    },
  ];

  const createdScenarios: Record<string, ScenarioRecord> = {};

  for (const def of scenarioDefs) {
    const persona = createdPersonas[def.personaName];
    if (!persona) continue;

    let scenario = existingScenarios.find((s) => s.name === def.name && s.status !== "archived");
    if (scenario) {
      if (!scenario.targetAgentId && def.targetAgentId) {
        await updateScenario(pool, null, scenario.id, { targetAgentId: def.targetAgentId });
        scenario = (await listScenarios(pool, null, { projectId })).find((s) => s.id === scenario!.id) || scenario;
      }
      createdScenarios[def.name] = scenario;
      scenarioResults.push({ id: scenario.id, name: scenario.name, priority: scenario.priority, status: "reused" });
    } else {
      const readiness = evaluateScenarioReadiness(def.name, def.config, "draft");
      scenario = await insertScenario(
        pool,
        null,
        {
          projectId,
          personaId: persona.id,
          targetAgentId: def.targetAgentId,
          name: def.name,
          description: def.description,
          priority: def.priority,
          config: def.config,
        },
        readiness.status,
      );
      createdScenarios[def.name] = scenario;
      scenarioResults.push({ id: scenario.id, name: scenario.name, priority: scenario.priority, status: "created" });
      await recordActivity(pool, null, {
        projectId,
        type: "scenario.created",
        summary: `Created test scenario "${scenario.name}"`,
      });
    }
  }

  // 6. OPTIONAL REAL SIMULATION EXECUTION (Only when explicitly requested)
  let simResult: DemoSetupResult["simulation"] | undefined;

  if (options.executeSimulation && agent1?.remoteAgentId && createdScenarios["Demanding Immediate Cash Refund"]) {
    logger.info("Executing real ElevenLabs simulation test for demo presentation...");
    const targetScenario = createdScenarios["Demanding Immediate Cash Refund"]!;
    const startRes = await startSimulationBatch({
      projectId,
      targetAgentId: agent1.id,
      scenarioIds: [targetScenario.id],
      name: `Adversarial Simulation: Refund Demands (${agent1.name})`,
      repeatCount: 1,
      concurrency: 1,
    });

    const batchId = startRes.batch.id;

    // Poll until completion with 40-second timeout
    let settled = false;
    let pollCount = 0;
    let polledBatch = startRes.batch;
    let polledRuns = startRes.runs;

    while (!settled && pollCount < 10) {
      await new Promise((r) => setTimeout(r, 4000));
      pollCount++;
      const pollRes = await pollSimulationBatch(batchId);
      polledBatch = pollRes.batch;
      polledRuns = pollRes.runs;
      settled = pollRes.isSettled;
    }

    let findingsCount = 0;
    let proposalsCount = 0;

    // If runs finished, run failure analysis & proposal generation on any failures
    for (const r of polledRuns) {
      if (r.status === "failed_evaluation" || r.evaluationResult === "failed") {
        try {
          const findings = await analyzeRun(r.id);
          findingsCount += findings.length;
          if (findings[0]) {
            await createFixProposal(findings[0].id);
            proposalsCount++;
          }
        } catch (analysisErr) {
          logger.warn("Analysis failed during demo setup", { error: (analysisErr as Error).message });
        }
      }
    }

    simResult = {
      batchId,
      status: polledBatch.status,
      scenariosTotal: polledBatch.totalScenarios,
      scenariosPassed: polledBatch.passedScenarios,
      scenariosFailed: polledBatch.failedScenarios,
      findingsCount,
      proposalsCount,
    };
  }

  return {
    project: { id: project.id, name: project.name, status: projectStatus },
    agents: agentResults,
    personas: personaResults,
    scenarios: scenarioResults,
    simulation: simResult,
  };
}
