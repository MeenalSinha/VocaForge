import { describe, expect, it, vi } from "vitest";
import { ElevenLabsError } from "@/server/integrations/elevenlabs/errors";
import { classifyRun, waitForInvocation } from "@/server/integrations/elevenlabs/simulation";
import { runSmoke, SMOKE_PREFIX } from "@/server/integrations/elevenlabs/smoke";

describe("classifyRun distinguishes the three outcomes", () => {
  it("passed", () => expect(classifyRun({ status: "passed", condition_result: { result: "success", rationale: "ok" } }).kind).toBe("passed"));
  it("failed success criteria (evaluated and failed)", () => {
    const o = classifyRun({ status: "failed", condition_result: { result: "failure", rationale: "invented a price" } });
    expect(o.kind).toBe("failed_criteria");
    expect(o.rationale).toBe("invented a price");
  });
  it("infrastructure error (failed without an evaluation, or errored)", () => {
    expect(classifyRun({ status: "failed" }).kind).toBe("infrastructure_error");
    expect(classifyRun({ status: "error" }).kind).toBe("infrastructure_error");
  });
  it("pending and unrecognised statuses are not treated as success", () => {
    expect(classifyRun({ status: "pending" }).kind).toBe("pending");
    expect(classifyRun({ status: "mystery" }).kind).toBe("inconclusive");
    expect(classifyRun({}).kind).toBe("inconclusive");
  });
});

describe("waitForInvocation", () => {
  const sleep = async () => undefined;
  it("polls until every run settles", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ id: "i", test_runs: [{ status: "pending" }] })
      .mockResolvedValueOnce({ id: "i", test_runs: [{ status: "passed", condition_result: { result: "success" } }] });
    const r = await waitForInvocation({ getTestInvocation: get }, "i", { sleep });
    expect(get).toHaveBeenCalledTimes(2);
    expect(r.outcomes[0]?.kind).toBe("passed");
  });
  it("times out with a timeout error instead of reporting success", async () => {
    let t = 0;
    const get = vi.fn().mockResolvedValue({ id: "i", test_runs: [{ status: "pending" }] });
    const err = await waitForInvocation({ getTestInvocation: get }, "i", { sleep, timeoutMs: 1000, now: () => (t += 600) }).catch((e) => e);
    expect(err).toBeInstanceOf(ElevenLabsError);
    expect(err.kind).toBe("timeout");
  });
});

describe("runSmoke orchestration (test double client)", () => {
  const config = {
    agent: { name: "poc", prompt: "p" },
    test: { name: "t", scenario: "s", successConditions: ["c"] },
  };
  const double = (invocation: unknown) => ({
    verifyAuth: vi.fn(async () => undefined),
    createAgent: vi.fn(async (_: unknown) => ({ agentId: "agent_x" })),
    createSimulationTest: vi.fn(async (_: unknown) => ({ testId: "test_x" })),
    runTests: vi.fn(async () => ({ id: "inv_x", test_runs: [] })),
    getTestInvocation: vi.fn(async () => invocation as never),
  });

  it("prefixes created resources so cleanup can only touch them, and records evidence", async () => {
    const c = double({ id: "inv_x", test_runs: [{ status: "passed", condition_result: { result: "success" } }] });
    const ev = await runSmoke(c as never, config, { sleep: async () => undefined }, "abc");
    expect((c.createAgent.mock.calls[0]![0] as { name: string }).name).toBe(`${SMOKE_PREFIX}abc-poc`);
    expect((c.createSimulationTest.mock.calls[0]![0] as { name: string }).name).toBe(`${SMOKE_PREFIX}abc-t`);
    expect(ev.agentId).toBe("agent_x");
    expect(ev.outcomes?.[0]?.kind).toBe("passed");
    expect(ev.steps.every((s) => s.ok)).toBe(true);
  });

  it("keeps partial evidence when a later step fails", async () => {
    const c = double({});
    c.runTests.mockRejectedValueOnce(new ElevenLabsError("permission_denied", "no"));
    const evidence = { startedAt: "x", steps: [] as { step: string; ok: boolean }[] };
    await expect(runSmoke(c as never, config, {}, "abc", evidence as never)).rejects.toThrow("no");
    expect(evidence.steps.at(-1)).toMatchObject({ step: "run test", ok: false });
    expect((evidence as { agentId?: string }).agentId).toBe("agent_x");
  });

  it("rejects an invalid smoke configuration before creating anything", async () => {
    const c = double({});
    await expect(runSmoke(c as never, { agent: {}, test: {} })).rejects.toThrow();
    expect(c.createAgent).not.toHaveBeenCalled();
  });
});
