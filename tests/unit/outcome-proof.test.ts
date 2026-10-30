import { describe, expect, it } from "vitest";
import { evaluateOutcomeProof, resolveOutcomeContract } from "@/server/analysis/outcome-proof";
import type { TranscriptMessage } from "@/server/simulations/schema";
import type { OutcomeContract, ScenarioConfig } from "@/server/personas/schema";

describe("Outcome Proof Deterministic Verification Engine", () => {
  const appointmentContract: OutcomeContract = {
    enabled: true,
    action: "appointment_booking",
    parameters: {
      day: "Tuesday",
      time: "3 PM",
    },
    requiredStatus: "confirmed",
    requiredEvidence: "booking_record",
    claimPatterns: ["booked", "confirmed", "scheduled", "all set"],
  };

  const sampleScenario: Partial<ScenarioConfig> = {
    objective: {
      primaryGoal: "Book a dental checkup on Tuesday at 3 PM",
      expectedOutcome: "Appointment confirmed in calendar system with reference code",
      requiredInformation: ["patient_name", "date", "time"],
      deliberatelyWithheld: [],
    },
    outcomeContract: appointmentContract,
  };

  it("Situation 1: Agent claims a booking succeeded, but no booking evidence exists -> UNVERIFIED", () => {
    const transcript: TranscriptMessage[] = [
      { role: "user", message: "Hi, I need to schedule an appointment for Tuesday at 3 PM please." },
      {
        role: "agent",
        message: "Great! Your appointment has been successfully booked for Tuesday at 3 PM. We will see you then!",
      },
      { role: "user", message: "Awesome, thank you!" },
    ];

    const result = evaluateOutcomeProof({
      transcript,
      scenarioSnapshot: sampleScenario,
      rawResult: null,
    });

    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.layers.conversationClaim.claimed).toBe(true);
    expect(result.layers.conversationClaim.claimExcerpt).toContain("booked for Tuesday at 3 PM");
    expect(result.layers.toolExecution.executed).toBe(false);
    expect(result.layers.businessOutcome.evidencePresent).toBe(false);

    // Rule: Verbal claim alone never treats task as verified
    expect(result.summary).toContain("Unverified");
    expect(result.reasons[0]).toContain("Verbal claims cannot serve as proof");

    // Field comparison checks
    const statusField = result.fieldComparisons.find((f) => f.field === "status");
    expect(statusField?.status).toBe("missing");
    const dayField = result.fieldComparisons.find((f) => f.field === "day");
    expect(dayField?.status).toBe("missing");
  });

  it("Situation 2: Booking tool executes, but returned booking details are incorrect -> FAILED", () => {
    const transcript: TranscriptMessage[] = [
      { role: "user", message: "Please schedule me for Tuesday at 3 PM." },
      {
        role: "agent",
        message: "Let me check our schedule and book that.",
        toolCalls: [
          {
            name: "schedule_appointment",
            parameters: {
              day: "Wednesday",
              time: "10 AM",
            },
            result: {
              status: "confirmed",
              bookingId: "bk_invalid_456",
              day: "Wednesday",
              time: "10 AM",
            },
          },
        ],
      },
      {
        role: "agent",
        message: "You're all set for Wednesday at 10 AM!",
      },
    ];

    const result = evaluateOutcomeProof({
      transcript,
      scenarioSnapshot: sampleScenario,
      rawResult: null,
    });

    expect(result.verdict).toBe("FAILED");
    expect(result.layers.conversationClaim.claimed).toBe(true);
    expect(result.layers.toolExecution.executed).toBe(true);
    expect(result.layers.toolExecution.parametersMatch).toBe(false);
    expect(result.layers.businessOutcome.evidencePresent).toBe(true);

    // Mismatches detected
    const dayComp = result.fieldComparisons.find((f) => f.field === "day");
    expect(dayComp?.status).toBe("mismatch");
    expect(dayComp?.expected).toBe("Tuesday");
    expect(dayComp?.actual).toBe("Wednesday");

    const timeComp = result.fieldComparisons.find((f) => f.field === "time");
    expect(timeComp?.status).toBe("mismatch");
    expect(timeComp?.expected).toBe("3 PM");
    expect(timeComp?.actual).toBe("10 AM");

    expect(result.reasons[0]).toContain("Available outcome evidence contradicts contract values");
  });

  it("Situation 3: Booking system returns genuine confirmed appointment matching expected outcome -> VERIFIED", () => {
    const transcript: TranscriptMessage[] = [
      { role: "user", message: "I would like to book a dental cleaning on Tuesday at 3 PM." },
      {
        role: "agent",
        message: "Allow me to book that slot for you right now.",
        toolCalls: [
          {
            name: "create_appointment",
            parameters: {
              day: "Tuesday",
              time: "3 PM",
              department: "Dentistry",
            },
            result: {
              status: "confirmed",
              bookingId: "bk_dental_99182",
              confirmationCode: "CONF-3PM-TUE",
              day: "Tuesday",
              time: "3 PM",
              persistedRecordId: "rec_77182991",
            },
          },
        ],
      },
      {
        role: "agent",
        message: "Your appointment is confirmed for Tuesday at 3 PM with confirmation code CONF-3PM-TUE.",
      },
    ];

    const result = evaluateOutcomeProof({
      transcript,
      scenarioSnapshot: sampleScenario,
      rawResult: null,
    });

    expect(result.verdict).toBe("VERIFIED");
    expect(result.layers.conversationClaim.claimed).toBe(true);
    expect(result.layers.toolExecution.executed).toBe(true);
    expect(result.layers.toolExecution.parametersMatch).toBe(true);
    expect(result.layers.businessOutcome.evidencePresent).toBe(true);
    expect(result.layers.businessOutcome.statusConfirmed).toBe(true);

    // All contract fields match
    const dayComp = result.fieldComparisons.find((f) => f.field === "day");
    expect(dayComp?.status).toBe("match");
    const timeComp = result.fieldComparisons.find((f) => f.field === "time");
    expect(timeComp?.status).toBe("match");
    const statusComp = result.fieldComparisons.find((f) => f.field === "status");
    expect(statusComp?.status).toBe("match");

    expect(result.summary).toContain("Business Outcome Verified");
  });

  it("External system returns explicit error or failure -> FAILED", () => {
    const transcript: TranscriptMessage[] = [
      { role: "user", message: "Book Tuesday 3 PM please." },
      {
        role: "agent",
        message: "Booking now...",
        toolCalls: [
          {
            name: "create_appointment",
            parameters: { day: "Tuesday", time: "3 PM" },
            result: {
              status: "failed",
              error: "Selected timeslot is no longer available in calendar system.",
            },
          },
        ],
      },
    ];

    const result = evaluateOutcomeProof({
      transcript,
      scenarioSnapshot: sampleScenario,
      rawResult: null,
    });

    expect(result.verdict).toBe("FAILED");
    expect(result.layers.businessOutcome.statusConfirmed).toBe(false);
    expect(result.reasons[0]).toContain("Selected timeslot is no longer available");
  });

  it("Infers contract automatically from scenario goal when contract is not explicitly configured", () => {
    const naturalScenario: Partial<ScenarioConfig> = {
      objective: {
        primaryGoal: "Customer wants to schedule an appointment for Tuesday at 3 PM",
        expectedOutcome: "Appointment booked with confirmation",
        requiredInformation: [],
        deliberatelyWithheld: [],
      },
    };

    const contract = resolveOutcomeContract(naturalScenario);
    expect(contract.enabled).toBe(true);
    expect(contract.action).toBe("appointment_booking");
    expect(contract.parameters.day).toBe("Tuesday");
    expect(contract.parameters.time).toBe("3 PM");
  });
});
