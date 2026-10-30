// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OutcomeProofCard, OutcomeProofBadge } from "@/components/simulations/outcome-proof-card";
import type { OutcomeProofResult } from "@/server/analysis/outcome-proof";

afterEach(() => {
  cleanup();
});

describe("Outcome Proof UI Components", () => {
  const verifiedProof: OutcomeProofResult = {
    verdict: "VERIFIED",
    summary: "Business Outcome Verified: appointment_booking confirmed by connected system evidence.",
    contract: {
      enabled: true,
      action: "appointment_booking",
      parameters: { day: "Tuesday", time: "3 PM" },
      requiredStatus: "confirmed",
      requiredEvidence: "booking_record",
      claimPatterns: ["booked", "confirmed"],
    },
    layers: {
      conversationClaim: {
        claimed: true,
        claimExcerpt: "Your appointment is confirmed for Tuesday at 3 PM.",
        claimTurnIndex: 2,
      },
      toolExecution: {
        executed: true,
        toolName: "create_appointment",
        invokedParameters: { day: "Tuesday", time: "3 PM" },
        toolTurnIndex: 1,
        parametersMatch: true,
        parameterMismatches: [],
      },
      businessOutcome: {
        evidencePresent: true,
        evidenceType: "booking_record",
        statusConfirmed: true,
        rawEvidence: { bookingId: "bk_12345", status: "confirmed", day: "Tuesday", time: "3 PM" },
      },
    },
    fieldComparisons: [
      { field: "action", expected: "appointment_booking", actual: "create_appointment", status: "match" },
      { field: "day", expected: "Tuesday", actual: "Tuesday", status: "match" },
      { field: "time", expected: "3 PM", actual: "3 PM", status: "match" },
      { field: "status", expected: "confirmed", actual: "confirmed", status: "match" },
    ],
    reasons: ["Genuine business outcome evidence verified: system confirmed appointment_booking."],
  };

  const unverifiedProof: OutcomeProofResult = {
    verdict: "UNVERIFIED",
    summary: "Business Outcome Unverified: Lacks external system confirmation evidence.",
    contract: {
      enabled: true,
      action: "appointment_booking",
      parameters: { day: "Tuesday", time: "3 PM" },
      requiredStatus: "confirmed",
      requiredEvidence: "booking_record",
      claimPatterns: ["booked", "confirmed"],
    },
    layers: {
      conversationClaim: {
        claimed: true,
        claimExcerpt: "I have booked your appointment for Tuesday at 3 PM!",
        claimTurnIndex: 3,
      },
      toolExecution: {
        executed: false,
        toolName: null,
        invokedParameters: null,
        toolTurnIndex: null,
        parametersMatch: false,
        parameterMismatches: [],
      },
      businessOutcome: {
        evidencePresent: false,
        evidenceType: null,
        statusConfirmed: false,
        rawEvidence: null,
      },
    },
    fieldComparisons: [
      { field: "action", expected: "appointment_booking", actual: "verbal_claim_only", status: "missing" },
      { field: "day", expected: "Tuesday", actual: null, status: "missing" },
      { field: "time", expected: "3 PM", actual: null, status: "missing" },
      { field: "status", expected: "confirmed", actual: null, status: "missing" },
    ],
    reasons: [
      "Agent verbally claimed completion, but no tool was invoked and no external outcome evidence exists. Verbal claims cannot serve as proof of business completion.",
    ],
  };

  it("renders verified outcome card with all three layers and field-by-field comparisons", () => {
    render(<OutcomeProofCard proof={verifiedProof} />);

    expect(screen.getByText("Outcome Proof")).toBeInTheDocument();
    expect(screen.getAllByText(/Outcome: VERIFIED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("A. Conversation Claim")).toBeInTheDocument();
    expect(screen.getByText("B. Tool Invocation")).toBeInTheDocument();
    expect(screen.getByText("C. Outcome Evidence")).toBeInTheDocument();
    expect(screen.getAllByText("create_appointment").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Match").length).toBe(4);
  });

  it("renders unverified outcome card with missing evidence indicators and warning rationale", () => {
    render(<OutcomeProofCard proof={unverifiedProof} />);

    expect(screen.getAllByText(/Outcome: UNVERIFIED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Verbal claims cannot serve as proof/i)).toBeInTheDocument();
    expect(screen.getByText("Claim Made")).toBeInTheDocument();
    expect(screen.getByText("Not Invoked")).toBeInTheDocument();
    expect(screen.getByText("No Evidence")).toBeInTheDocument();
    expect(screen.getAllByText("Missing").length).toBe(4);
  });

  it("renders standalone OutcomeProofBadge correctly for all verdicts", () => {
    const { rerender } = render(<OutcomeProofBadge verdict="VERIFIED" />);
    expect(screen.getByText("Outcome: VERIFIED")).toBeInTheDocument();

    rerender(<OutcomeProofBadge verdict="FAILED" />);
    expect(screen.getByText("Outcome: FAILED")).toBeInTheDocument();

    rerender(<OutcomeProofBadge verdict="UNVERIFIED" />);
    expect(screen.getByText("Outcome: UNVERIFIED")).toBeInTheDocument();
  });
});
