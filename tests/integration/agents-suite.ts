import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { ElevenLabsError } from "@/server/integrations/elevenlabs/errors";
import {
  archiveAgent, createAgent, createLiveSession, deleteRemoteAgent, dismissOperation, getAgentDetail, listAgents,
  listOpenOperations, reconcileOperation, refreshAgent, saveAgentConfig, syncAgent,
} from "@/server/agents/service";
import { createProject } from "@/server/projects/service";
import { AppError, ConflictError, NotFoundError } from "@/server/errors";
import { buildRemotePayload } from "@/server/agents/prompt";
import { sampleConfig } from "../sample-config";

const uniq = () => Math.random().toString(36).slice(2, 10);

/** Test double for the ElevenLabs client. Only exists under tests/. Each method is a spy with a controllable result. */
function fakeRemote() {
  return {
    createAgentFromPayload: vi.fn(async (_p: unknown) => ({ agentId: `agent_${uniq()}` })),
    getAgent: vi.fn(async (_id: string) => ({ agent_id: "x", conversation_config: {} as Record<string, unknown> })),
    updateAgent: vi.fn(async (_id: string, _p: unknown) => undefined),
    deleteAgent: vi.fn(async (_id: string) => undefined),
    getSignedUrl: vi.fn(async (_id: string) => "wss://example.invalid/session?token=t"),
  };
}
type Remote = ReturnType<typeof fakeRemote>;

export function agentServiceSuite(getStore: () => Pool) {
  const base = async (remote: Remote, ownerId: string | null = null) => {
    const ctx = { store: getStore(), ownerId, remote: remote as never };
    const project = await createProject({ name: `proj-${uniq()}` }, ctx);
    return { ctx, project };
  };
  const make = async (remote: Remote, ownerId: string | null = null, config = { ...sampleConfig(), identity: { ...sampleConfig().identity, name: `Agent ${uniq()}` } }) => {
    const { ctx, project } = await base(remote, ownerId);
    const { agent } = await createAgent({ projectId: project.id, config, idempotencyKey: `key-${uniq()}-${uniq()}`, creationPrompt: "desc", useCase: "customer-support" }, ctx);
    return { ctx, project, agent, config };
  };
  const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as AppError).code;

  describe("agent creation", () => {
    it("creates the remote agent once, stores the id it returned, and writes version 1 as synced", async () => {
      const remote = fakeRemote();
      remote.createAgentFromPayload.mockResolvedValueOnce({ agentId: "agent_returned_by_remote" });
      const { ctx, project } = await base(remote);
      const config = sampleConfig();
      const res = await createAgent({ projectId: project.id, config, idempotencyKey: `k-${uniq()}-${uniq()}`, useCase: "customer-support", creationPrompt: "my prompt" }, ctx);
      expect(res.replayed).toBe(false);
      expect(res.agent).toMatchObject({ remoteAgentId: "agent_returned_by_remote", status: "active", configVersion: 1, syncedVersion: 1, useCase: "customer-support", creationPrompt: "my prompt", projectId: project.id });
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
      expect(remote.createAgentFromPayload.mock.calls[0]![0]).toEqual(buildRemotePayload(config));
      const { agent, versions } = await getAgentDetail(res.agent.id, ctx);
      expect(agent.config).toEqual(config);
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ version: 1, source: "created", syncStatus: "synced" });
    });

    it("is idempotent: the same key returns the same agent and never calls ElevenLabs twice", async () => {
      const remote = fakeRemote();
      const { ctx, project } = await base(remote);
      const input = { projectId: project.id, config: sampleConfig(), idempotencyKey: `same-${uniq()}-${uniq()}` };
      const a = await createAgent(input, ctx);
      const b = await createAgent(input, ctx);
      expect(b.replayed).toBe(true);
      expect(b.agent.id).toBe(a.agent.id);
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
    });

    it("handles concurrent duplicate submissions with a single remote creation", async () => {
      const remote = fakeRemote();
      const { ctx, project } = await base(remote);
      const input = { projectId: project.id, config: sampleConfig(), idempotencyKey: `race-${uniq()}-${uniq()}` };
      const results = await Promise.allSettled([createAgent(input, ctx), createAgent(input, ctx)]);
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    });

    it("on a definite remote failure stores no agent and allows a fresh attempt with a new key", async () => {
      const remote = fakeRemote();
      remote.createAgentFromPayload.mockRejectedValueOnce(new ElevenLabsError("auth_invalid", "ElevenLabs rejected the API key.", 401));
      const { ctx, project } = await base(remote);
      const key = `fail-${uniq()}-${uniq()}`;
      expect(await code(createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, ctx))).toBe("elevenlabs_auth_invalid");
      expect(await listAgents({ projectId: project.id, status: "all" }, ctx)).toHaveLength(0);
      expect(await code(createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, ctx))).toBe("conflict");
      const ok = await createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: `new-${uniq()}-${uniq()}` }, ctx);
      expect(ok.agent.remoteAgentId).toMatch(/^agent_/);
    });

    it.each(["permission_denied", "rate_limited", "validation", "missing_credentials"] as const)("treats %s as a definite failure (nothing created, nothing to reconcile)", async (kind) => {
      const remote = fakeRemote();
      remote.createAgentFromPayload.mockRejectedValueOnce(new ElevenLabsError(kind, "x"));
      const { ctx, project } = await base(remote);
      await createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: `k-${uniq()}-${uniq()}` }, ctx).catch(() => undefined);
      expect((await listOpenOperations(ctx)).filter((o) => o.projectId === project.id)).toHaveLength(0);
    });

    it("on an uncertain outcome (network) does NOT retry, reports uncertainty, and surfaces it for attention", async () => {
      const remote = fakeRemote();
      remote.createAgentFromPayload.mockRejectedValueOnce(new ElevenLabsError("network", "Could not reach the ElevenLabs API."));
      const { ctx, project } = await base(remote);
      const key = `unk-${uniq()}-${uniq()}`;
      const err = (await createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, ctx).catch((e) => e)) as AppError;
      expect(err.code).toBe("creation_outcome_unknown");
      expect(err.message).toMatch(/may or may not/);
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
      expect(await code(createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, ctx))).toBe("conflict");
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
      const open = (await listOpenOperations(ctx)).filter((o) => o.projectId === project.id);
      expect(open).toHaveLength(1);
      expect(open[0]!.status).toBe("unknown");
      await dismissOperation(open[0]!.id, ctx);
      expect((await listOpenOperations(ctx)).filter((o) => o.projectId === project.id)).toHaveLength(0);
    });

    it("when the remote agent exists but the local save fails, it says so, keeps the remote id, and can reconcile without a second remote call", async () => {
      const remote = fakeRemote();
      remote.createAgentFromPayload.mockResolvedValueOnce({ agentId: "agent_orphan_candidate" });
      const { ctx, project } = await base(remote);
      const pool = getStore();
      const failing = {
        query: pool.query.bind(pool),
        connect: async () => {
          const c = await pool.connect();
          const original = c.query;
          const q = original.bind(c) as (...a: unknown[]) => Promise<unknown>;
          const release = c.release.bind(c);
          (c as unknown as { query: unknown }).query = (text: unknown, ...rest: unknown[]) => String(text).includes("INSERT INTO agents") ? Promise.reject(new Error("disk full")) : q(text, ...rest);
          // Pools reuse client objects, so restore the real query method on release.
          (c as unknown as { release: unknown }).release = () => { (c as unknown as { query: unknown }).query = original; (c as unknown as { release: unknown }).release = release; release(); };
          return c;
        },
      };
      const key = `orph-${uniq()}-${uniq()}`;
      const err = (await createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, { ...ctx, store: failing as never }).catch((e) => e)) as AppError;
      expect(err.code).toBe("persistence_failed_after_remote_create");
      expect(err.message).toContain("agent_orphan_candidate");
      expect(await listAgents({ projectId: project.id, status: "all" }, ctx)).toHaveLength(0);
      const open = (await listOpenOperations(ctx)).find((o) => o.projectId === project.id)!;
      expect(open).toMatchObject({ status: "remote_created", remoteAgentId: "agent_orphan_candidate" });
      const agent = await reconcileOperation(open.id, ctx);
      expect(agent.remoteAgentId).toBe("agent_orphan_candidate");
      expect(remote.createAgentFromPayload).toHaveBeenCalledTimes(1);
      const replay = await createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: key }, ctx);
      expect(replay.agent.id).toBe(agent.id);
      expect(await code(dismissOperation(open.id, ctx))).toBe("conflict");
    });

    it("refuses unknown or archived projects and invalid configurations before calling ElevenLabs", async () => {
      const remote = fakeRemote();
      const { ctx, project } = await base(remote);
      expect(await code(createAgent({ projectId: "00000000-0000-4000-8000-000000000000", config: sampleConfig(), idempotencyKey: "abcdefgh1" }, ctx))).toBe("not_found");
      expect(await code(createAgent({ projectId: project.id, config: { ...sampleConfig(), identity: { name: "", description: "", role: "" } }, idempotencyKey: "abcdefgh2" }, ctx))).toBe("validation_error");
      expect(await code(createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: "short" }, ctx))).toBe("validation_error");
      expect(remote.createAgentFromPayload).not.toHaveBeenCalled();
    });
  });

  describe("saving, versions and reopening", () => {
    it("saves a changed configuration as a new version and reopens it exactly", async () => {
      const { ctx, agent } = await make(fakeRemote());
      const next = { ...agent.config, behavior: { ...agent.config.behavior, welcomeMessage: "Good day!" } };
      const saved = await saveAgentConfig(agent.id, { config: next, baseVersion: 1 }, ctx);
      expect(saved.changed).toBe(true);
      expect(saved.agent).toMatchObject({ configVersion: 2, syncedVersion: 1 });
      const { agent: reopened, versions } = await getAgentDetail(agent.id, ctx);
      expect(reopened.config).toEqual(next);
      expect(versions.map((v) => v.version)).toEqual([2, 1]);
      expect(versions[0]).toMatchObject({ source: "manual_edit", syncStatus: "not_synced" });
      expect(versions[0]!.summary).toMatch(/welcome message/);
    });
    it("does not create a version when nothing changed", async () => {
      const { ctx, agent } = await make(fakeRemote());
      const r = await saveAgentConfig(agent.id, { config: agent.config, baseVersion: 1 }, ctx);
      expect(r.changed).toBe(false);
      expect((await getAgentDetail(agent.id, ctx)).versions).toHaveLength(1);
    });
    it("rejects a stale baseVersion and invalid configurations", async () => {
      const { ctx, agent } = await make(fakeRemote());
      const next = { ...agent.config, identity: { ...agent.config.identity, role: "Changed role" } };
      await saveAgentConfig(agent.id, { config: next, baseVersion: 1 }, ctx);
      expect(await code(saveAgentConfig(agent.id, { config: { ...next, identity: { ...next.identity, role: "Another" } }, baseVersion: 1 }, ctx))).toBe("conflict");
      expect(await code(saveAgentConfig(agent.id, { config: { ...next, language: { primary: "bad code", additional: [] } }, baseVersion: 2 }, ctx))).toBe("validation_error");
    });
    it("records refinement as its own source", async () => {
      const { ctx, agent } = await make(fakeRemote());
      const next = { ...agent.config, behavior: { ...agent.config.behavior, tone: "very formal" } };
      await saveAgentConfig(agent.id, { config: next, baseVersion: 1, source: "refinement", summary: "Refinement: more formal" }, ctx);
      expect((await getAgentDetail(agent.id, ctx)).versions[0]).toMatchObject({ source: "refinement", summary: "Refinement: more formal" });
    });
  });

  describe("remote synchronisation", () => {
    it("sends the saved version, then marks that exact version synced", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      const next = { ...agent.config, behavior: { ...agent.config.behavior, welcomeMessage: "Hey" } };
      await saveAgentConfig(agent.id, { config: next, baseVersion: 1 }, ctx);
      const synced = await syncAgent(agent.id, ctx);
      expect(remote.updateAgent).toHaveBeenCalledWith(agent.remoteAgentId, buildRemotePayload(next));
      expect(synced).toMatchObject({ configVersion: 2, syncedVersion: 2 });
      expect((await getAgentDetail(agent.id, ctx)).versions[0]).toMatchObject({ syncStatus: "synced" });
    });
    it("on failure leaves the version unsynced, records the error, and reports it", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      await saveAgentConfig(agent.id, { config: { ...agent.config, behavior: { ...agent.config.behavior, tone: "calm" } }, baseVersion: 1 }, ctx);
      remote.updateAgent.mockRejectedValueOnce(new ElevenLabsError("rate_limited", "limit"));
      expect(await code(syncAgent(agent.id, ctx))).toBe("elevenlabs_rate_limited");
      const d = await getAgentDetail(agent.id, ctx);
      expect(d.agent.syncedVersion).toBe(1);
      expect(d.versions[0]).toMatchObject({ syncStatus: "failed" });
      expect(d.versions[0]!.syncError).toMatch(/limit/i);
    });
    it("marks the agent remote_missing when ElevenLabs cannot find it", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      remote.updateAgent.mockRejectedValueOnce(new ElevenLabsError("unsupported", "not found", 404));
      await syncAgent(agent.id, ctx).catch(() => undefined);
      expect((await getAgentDetail(agent.id, ctx)).agent.status).toBe("remote_missing");
    });
    it("refresh compares the real remote configuration with the saved one", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      const expected = buildRemotePayload(agent.config).conversation_config;
      remote.getAgent.mockResolvedValueOnce({ agent_id: agent.remoteAgentId, conversation_config: JSON.parse(JSON.stringify(expected)) });
      const same = await refreshAgent(agent.id, ctx);
      expect(same.remote).toMatchObject({ found: true, matchesLocal: true });
      const changed = JSON.parse(JSON.stringify(expected));
      changed.agent.first_message = "edited elsewhere";
      remote.getAgent.mockResolvedValueOnce({ agent_id: agent.remoteAgentId, conversation_config: changed });
      const diff = await refreshAgent(agent.id, ctx);
      expect(diff.remote).toMatchObject({ matchesLocal: false, differences: ["welcome message"] });
      remote.getAgent.mockRejectedValueOnce(new ElevenLabsError("unsupported", "gone", 404));
      const gone = await refreshAgent(agent.id, ctx);
      expect(gone.remote.found).toBe(false);
      expect(gone.agent.status).toBe("remote_missing");
    });
  });

  describe("lifecycle and sessions", () => {
    it("archive is local only and never calls ElevenLabs delete", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      expect((await archiveAgent(agent.id, ctx)).status).toBe("archived");
      expect(remote.deleteAgent).not.toHaveBeenCalled();
      expect((await listAgents({ projectId: agent.projectId }, ctx))).toHaveLength(0);
      expect((await listAgents({ projectId: agent.projectId, status: "archived" }, ctx))).toHaveLength(1);
      expect(await code(saveAgentConfig(agent.id, { config: agent.config, baseVersion: 1 }, ctx))).toBe("conflict");
    });
    it("remote delete requires the exact name and is confirmed through ElevenLabs", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      expect(await code(deleteRemoteAgent(agent.id, "wrong", ctx))).toBe("validation_error");
      expect(remote.deleteAgent).not.toHaveBeenCalled();
      remote.getAgent.mockRejectedValueOnce(new ElevenLabsError("unsupported", "gone", 404));
      const done = await deleteRemoteAgent(agent.id, agent.name, ctx);
      expect(done.status).toBe("remote_deleted");
      expect(remote.deleteAgent).toHaveBeenCalledWith(agent.remoteAgentId);
    });
    it("does not claim deletion when ElevenLabs still returns the agent", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      expect(await code(deleteRemoteAgent(agent.id, agent.name, ctx))).toBe("deletion_unconfirmed");
      expect((await getAgentDetail(agent.id, ctx)).agent.status).toBe("active");
    });
    it("issues a live session URL for the saved agent's own remote id, and refuses unusable agents", async () => {
      const remote = fakeRemote();
      const { ctx, agent } = await make(remote);
      const s = await createLiveSession(agent.id, ctx);
      expect(remote.getSignedUrl).toHaveBeenCalledWith(agent.remoteAgentId);
      expect(s).toMatchObject({ signedUrl: expect.stringContaining("wss://"), remoteAgentId: agent.remoteAgentId });
      await archiveAgent(agent.id, ctx);
      expect(await code(createLiveSession(agent.id, ctx))).toBe("conflict");
      remote.getSignedUrl.mockRejectedValueOnce(new ElevenLabsError("permission_denied", "no"));
      const other = await make(remote);
      expect(await code(createLiveSession(other.agent.id, other.ctx))).toBe("elevenlabs_permission_denied");
    });
  });

  describe("access scoping", () => {
    it("does not expose or modify another owner's agents", async () => {
      const remote = fakeRemote();
      const mine = await make(remote, `owner-${uniq()}`);
      const other = { store: getStore(), ownerId: `owner-${uniq()}`, remote: remote as never };
      await expect(getAgentDetail(mine.agent.id, other)).rejects.toBeInstanceOf(NotFoundError);
      await expect(syncAgent(mine.agent.id, other)).rejects.toBeInstanceOf(NotFoundError);
      await expect(archiveAgent(mine.agent.id, other)).rejects.toBeInstanceOf(NotFoundError);
      expect(await listAgents({}, other)).toHaveLength(0);
      expect(await code(getAgentDetail("not-a-uuid", mine.ctx))).toBe("not_found");
    });
    it("rejects creating into another owner's project", async () => {
      const remote = fakeRemote();
      const { project } = await base(remote, `owner-${uniq()}`);
      const intruder = { store: getStore(), ownerId: `owner-${uniq()}`, remote: remote as never };
      await expect(createAgent({ projectId: project.id, config: sampleConfig(), idempotencyKey: `k-${uniq()}-${uniq()}` }, intruder)).rejects.toBeInstanceOf(NotFoundError);
      expect(ConflictError).toBeDefined();
    });
  });
}
