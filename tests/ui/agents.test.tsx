// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentBuilder } from "@/components/agents/agent-builder";
import { AgentDetail } from "@/components/agents/agent-detail";
import { RefinePanel } from "@/components/agents/refine-panel";
import { VoicePicker } from "@/components/agents/voice-picker";
import { STARTERS } from "@/server/agents/starters";
import { sampleConfig } from "../sample-config";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/agents" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const apiErr = (code: string, message: string, status = 502, fieldErrors?: object) => new Response(JSON.stringify({ error: { code, message, fieldErrors } }), { status });
const stub = (h: Handler) => { const f = vi.fn(async (u: string | URL, i?: RequestInit) => h(String(u), i)); vi.stubGlobal("fetch", f); return f; };
const voicesPage = { voices: [{ voiceId: "voice_one_123", name: "Ana", category: "premade", description: "Warm", previewUrl: null, labels: { accent: "indian" }, languages: ["hi"] }], nextPageToken: null, hasMore: false, filteredByLanguage: false };

beforeEach(() => { vi.stubGlobal("crypto", { randomUUID: (() => { let n = 0; return () => `uuid-${++n}`; })() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); refresh.mockClear(); });

const builderProps = { projects: [{ id: "p1", name: "Clinic" }], starters: STARTERS, promptMax: 500, generationReady: true, elevenlabsReady: true };
const handlers = (over: Record<string, Handler> = {}): Handler => (u, i) => {
  for (const [k, h] of Object.entries(over)) if (u === k || (k !== "/api/agents" && u.startsWith(k))) return h(u, i);
  if (u.startsWith("/api/voices")) return json(voicesPage);
  if (u === "/api/agents/generate") return json({ config: sampleConfig(), openQuestions: ["What are your hours?"] });
  if (u === "/api/agents") return json({ agent: { id: "agent-1" }, replayed: false }, 201);
  return new Response("{}", { status: 404 });
};

describe("AgentBuilder", () => {
  it("explains and blocks generation when the provider is not configured", () => {
    stub(handlers());
    render(<AgentBuilder {...builderProps} generationReady={false} />);
    expect(screen.getByText("The generation provider is not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate agent configuration" })).toBeDisabled();
  });

  it("sends the prompt and chosen starter to the server and shows what came back for review", async () => {
    const f = stub(handlers());
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.selectOptions(screen.getByLabelText(/Starting point/), "customer-support");
    await user.type(screen.getByLabelText("What should your assistant do?"), "A friendly desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    expect(await screen.findByDisplayValue("Desk")).toBeInTheDocument();
    expect(screen.getByText(/What are your hours\?/)).toBeInTheDocument();
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    const call = f.mock.calls.find((c) => c[0] === "/api/agents/generate")!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ prompt: "A friendly desk", useCase: "customer-support" });
  });

  it("shows a generation failure and no configuration", async () => {
    stub(handlers({ "/api/agents/generate": () => apiErr("generation_network", "Could not reach the generation provider.") }));
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "x");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    expect(await screen.findByText("Could not reach the generation provider.")).toBeInTheDocument();
    expect(screen.queryByText("2. Review and edit")).not.toBeInTheDocument();
  });

  it("edits fields in the review step and submits the edited configuration with an idempotency key", async () => {
    const f = stub(handlers());
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    const welcome = await screen.findByLabelText("Welcome message");
    await user.clear(welcome);
    await user.type(welcome, "Namaste!");
    await user.click(await screen.findByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Create agent" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agents/agent-1"));
    const body = JSON.parse(String((f.mock.calls.find((c) => c[0] === "/api/agents")![1] as RequestInit).body));
    expect(body).toMatchObject({ projectId: "p1", idempotencyKey: expect.stringMatching(/^create-/), config: { behavior: { welcomeMessage: "Namaste!" }, voice: { voiceId: "voice_one_123" } } });
  });

  it("blocks invalid edits client-side without calling the server", async () => {
    const f = stub(handlers());
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    await user.clear(await screen.findByLabelText("Agent name"));
    await user.click(screen.getByRole("button", { name: "Create agent" }));
    expect(await screen.findByText("Required.")).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === "/api/agents")).toBe(false);
  });

  it("does not create twice on rapid double clicks", async () => {
    let creates = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<Response>((r) => { release = () => r(json({ agent: { id: "a" } }, 201)); });
    stub(handlers({ "/api/agents": () => { creates++; return gate; } }));
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    const btn = await screen.findByRole("button", { name: "Create agent" });
    await user.dblClick(btn);
    expect(creates).toBe(1);
    release();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(creates).toBe(1);
  });

  it("reuses the same key after an uncertain outcome and warns instead of claiming failure", async () => {
    const keys: string[] = [];
    stub(handlers({ "/api/agents": (u, i) => { if (u === "/api/agents") { keys.push(JSON.parse(String(i?.body)).idempotencyKey); return apiErr("creation_outcome_unknown", "The request may or may not have created an agent."); } return json({}); } }));
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    await user.click(await screen.findByRole("button", { name: "Create agent" }));
    expect(await screen.findByText("Outcome needs checking")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create agent" }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);
    expect(push).not.toHaveBeenCalled();
  });

  it("uses a new key after a definite failure and reports that nothing was created", async () => {
    const keys: string[] = [];
    stub(handlers({ "/api/agents": (u, i) => { if (u === "/api/agents") { keys.push(JSON.parse(String(i?.body)).idempotencyKey); return apiErr("elevenlabs_auth_invalid", "ElevenLabs rejected the API key.", 502); } return json({}); } }));
    const user = userEvent.setup();
    render(<AgentBuilder {...builderProps} />);
    await user.type(screen.getByLabelText("What should your assistant do?"), "desk");
    await user.click(screen.getByRole("button", { name: "Generate agent configuration" }));
    await user.click(await screen.findByRole("button", { name: "Create agent" }));
    expect(await screen.findByText("The agent was not created")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create agent" }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("VoicePicker", () => {
  it("lists voices returned by the API and selects one", async () => {
    stub(handlers());
    const onSelect = vi.fn();
    render(<VoicePicker previewText="Hi" onSelect={onSelect} />);
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("accent: indian")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Select" }));
    expect(onSelect).toHaveBeenCalledWith("voice_one_123");
  });
  it("shows the error and no fallback list when ElevenLabs is unavailable", async () => {
    stub(handlers({ "/api/voices": () => apiErr("elevenlabs_missing_credentials", "ELEVENLABS_API_KEY is not set on the server.", 503) }));
    render(<VoicePicker previewText="Hi" onSelect={vi.fn()} />);
    expect(await screen.findByText("ELEVENLABS_API_KEY is not set on the server.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument();
  });
  it("passes search and language to the server", async () => {
    const f = stub(handlers());
    const user = userEvent.setup();
    render(<VoicePicker previewText="Hi" onSelect={vi.fn()} />);
    await screen.findByText("Ana");
    await user.type(screen.getByLabelText("Search voices"), "ana");
    await user.type(screen.getByLabelText("Language"), "hi");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(f.mock.calls.at(-1)![0]).toBe("/api/voices?search=ana&language=hi"));
  });
  it("requests a real text-to-speech preview and reports its failure", async () => {
    const f = stub(handlers({ "/api/voices/voice_one_123/preview": () => apiErr("elevenlabs_permission_denied", "Permission denied for text to speech.", 502) }));
    const user = userEvent.setup();
    render(<VoicePicker previewText="Hello there" onSelect={vi.fn()} />);
    await screen.findByText("Ana");
    await user.click(screen.getByRole("button", { name: /Preview/ }));
    expect(await screen.findByText("Permission denied for text to speech.")).toBeInTheDocument();
    const call = f.mock.calls.find((c) => String(c[0]).endsWith("/preview"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ text: "Hello there" });
  });
});

describe("RefinePanel", () => {
  const change = { path: "behavior.welcomeMessage", label: "Welcome message", before: "Hello, how can I help?", after: "Hi!" };
  const proposed = { ...sampleConfig(), behavior: { ...sampleConfig().behavior, welcomeMessage: "Hi!" } };
  it("shows the proposed change without applying it, then applies on approval", async () => {
    const f = stub(handlers({ "/api/agents/refine": () => json({ proposed, changes: [change], openQuestions: [] }) }));
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<RefinePanel config={sampleConfig()} onApply={onApply} />);
    await user.type(screen.getByLabelText("What should change?"), "Shorter welcome");
    await user.click(screen.getByRole("button", { name: "Propose changes" }));
    expect(await screen.findByText("Proposed changes (not applied yet)")).toBeInTheDocument();
    expect(screen.getByText("Hi!")).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    expect(JSON.parse(String((f.mock.calls[0]![1] as RequestInit).body)).instruction).toBe("Shorter welcome");
    await user.click(screen.getByRole("button", { name: "Apply to editor" }));
    expect(onApply).toHaveBeenCalledWith(proposed, "Refinement: Shorter welcome");
  });
  it("lets the user reject a proposal, and reports provider errors", async () => {
    stub(handlers({ "/api/agents/refine": () => json({ proposed, changes: [change], openQuestions: ["Which language?"] }) }));
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<RefinePanel config={sampleConfig()} onApply={onApply} />);
    await user.type(screen.getByLabelText("What should change?"), "x");
    await user.click(screen.getByRole("button", { name: "Propose changes" }));
    expect(await screen.findByText("Which language?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.queryByText("Proposed changes (not applied yet)")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    stub(handlers({ "/api/agents/refine": () => apiErr("generation_rate_limited", "The generation provider is rate limiting requests.", 429) }));
    await user.type(screen.getByLabelText("What should change?"), "y");
    await user.click(screen.getByRole("button", { name: "Propose changes" }));
    expect(await screen.findByText("The generation provider is rate limiting requests.")).toBeInTheDocument();
  });
  it("reports when the model proposes nothing", async () => {
    stub(handlers({ "/api/agents/refine": () => json({ proposed: sampleConfig(), changes: [], openQuestions: [] }) }));
    const user = userEvent.setup();
    render(<RefinePanel config={sampleConfig()} onApply={vi.fn()} />);
    await user.type(screen.getByLabelText("What should change?"), "x");
    await user.click(screen.getByRole("button", { name: "Propose changes" }));
    expect(await screen.findByText("No changes proposed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument();
  });
});

describe("AgentDetail", () => {
  const agent = { id: "a1", projectId: "p1", projectName: "Clinic", name: "Desk", description: null, useCase: null, creationPrompt: null, config: sampleConfig(), configVersion: 1, syncedVersion: 1, voiceId: null, primaryLanguage: "en", remoteAgentId: "agent_remote_1", status: "active" as const, remoteCheckedAt: null, remoteStatusNote: null, createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-10-28T10:00:00.000Z" };
  const versions = [{ id: "v1", version: 1, config: sampleConfig(), summary: "Created and sent to ElevenLabs", source: "created" as const, syncStatus: "synced" as const, syncedAt: null, syncError: null, createdAt: "2026-10-28T10:00:00.000Z" }];

  it("distinguishes saved, unsaved and unsynchronised states accurately", async () => {
    const saved2 = { ...agent, configVersion: 2, config: { ...agent.config, behavior: { ...agent.config.behavior, tone: "warm and calm" } } };
    stub((u, i) => {
      if (i?.method === "PATCH") return json({ agent: saved2, changed: true });
      return json({ agent: saved2, versions });
    });
    const user = userEvent.setup();
    render(<AgentDetail initialAgent={agent} initialVersions={versions} />);
    expect(screen.getByText("Version 1 sent to ElevenLabs")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.type(screen.getByLabelText("Tone"), " and calm");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to ElevenLabs" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    expect(screen.getByText("Version 2 saved, not sent to ElevenLabs")).toBeInTheDocument();
  });

  it("saves with the base version and shows server conflicts", async () => {
    const f = stub((u, i) => (i?.method === "PATCH" ? apiErr("conflict", "This agent was changed elsewhere since you opened it.", 409) : json({ agent, versions })));
    const user = userEvent.setup();
    render(<AgentDetail initialAgent={agent} initialVersions={versions} />);
    await user.type(screen.getByLabelText("Tone"), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This agent was changed elsewhere since you opened it.")).toBeInTheDocument();
    const patch = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")!;
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toMatchObject({ baseVersion: 1, source: "manual_edit" });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("records a refinement as its source when saved after applying a proposal", async () => {
    const proposed = { ...sampleConfig(), behavior: { ...sampleConfig().behavior, tone: "formal" } };
    const f = stub((u, i) => {
      if (u === "/api/agents/refine") return json({ proposed, changes: [{ path: "behavior.tone", label: "Tone", before: "warm", after: "formal" }], openQuestions: [] });
      if (i?.method === "PATCH") return json({ agent: { ...agent, configVersion: 2 }, changed: true });
      return json({ agent, versions });
    });
    const user = userEvent.setup();
    render(<AgentDetail initialAgent={agent} initialVersions={versions} />);
    await user.type(screen.getByLabelText("What should change?"), "more formal");
    await user.click(screen.getByRole("button", { name: "Propose changes" }));
    await user.click(await screen.findByRole("button", { name: "Apply to editor" }));
    expect(screen.getByLabelText("Tone")).toHaveValue("formal");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")).toBe(true));
    const patch = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")!;
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toMatchObject({ source: "refinement", summary: "Refinement: more formal" });
  });

  it("requires typing the exact name before a remote delete can be sent", async () => {
    const f = stub(() => json({ agent, versions }));
    const user = userEvent.setup();
    render(<AgentDetail initialAgent={agent} initialVersions={versions} />);
    await user.click(screen.getByRole("button", { name: "Delete from ElevenLabs" }));
    const dialog = await screen.findByRole("dialog");
    const del = within(dialog).getByRole("button", { name: "Delete permanently" });
    expect(del).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Type "Desk"/), "Desk");
    expect(del).toBeEnabled();
    expect(f.mock.calls.filter((c) => !String(c[0]).startsWith("/api/voices"))).toHaveLength(0);
  });

  it("shows a failed send and the stored error in the history", async () => {
    stub((u, i) => (i?.method === "POST" && u.endsWith("/sync") ? apiErr("elevenlabs_rate_limited", "ElevenLabs rate limit or concurrency limit reached.", 429) : json({ agent, versions })));
    const user = userEvent.setup();
    render(<AgentDetail initialAgent={agent} initialVersions={versions} />);
    await user.click(screen.getByRole("button", { name: "Send to ElevenLabs" }));
    expect(await screen.findByText("ElevenLabs rate limit or concurrency limit reached.")).toBeInTheDocument();
  });

  it("locks editing for archived agents", () => {
    stub(() => json({}));
    render(<AgentDetail initialAgent={{ ...agent, status: "archived" }} initialVersions={versions} />);
    expect(screen.getByLabelText("Tone")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });
});
