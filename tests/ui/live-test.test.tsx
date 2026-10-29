// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test double for the ElevenLabs React SDK. It only records calls and lets a test emit real-shaped events.
const sdk = vi.hoisted(() => ({
  startSession: vi.fn(), endSession: vi.fn(), setMuted: vi.fn(),
  state: { status: "disconnected" as string, isSpeaking: false, isMuted: false },
  opts: undefined as undefined | { onMessage?: (m: unknown) => void; onError?: (m: string) => void },
}));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConversation: () => ({ ...sdk.state, startSession: (o: typeof sdk.opts & { signedUrl: string }) => { sdk.opts = o; sdk.startSession(o); }, endSession: sdk.endSession, setMuted: sdk.setMuted }),
}));
import { LiveTest } from "@/components/agents/live-test";

const setMic = (present: boolean) => Object.defineProperty(navigator, "mediaDevices", { value: present ? { getUserMedia: vi.fn() } : undefined, configurable: true });
beforeEach(() => { sdk.state = { status: "disconnected", isSpeaking: false, isMuted: false }; sdk.startSession.mockClear(); setMic(true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LiveTest", () => {
  it("requests a server-issued session for the selected saved agent, then starts the SDK with that URL", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { signedUrl: "wss://example.invalid/s?token=abc" } }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    render(<LiveTest agentId="agent-uuid-1" agentName="Desk" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Start conversation/ }));
    await waitFor(() => expect(sdk.startSession).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith("/api/agents/agent-uuid-1/session", expect.objectContaining({ method: "POST" }));
    expect(sdk.startSession.mock.calls[0]![0]).toMatchObject({ signedUrl: "wss://example.invalid/s?token=abc" });
    expect(JSON.stringify(sdk.startSession.mock.calls[0]![0])).not.toMatch(/xi-api-key|sk_/);
  });

  it("shows only transcript lines that the SDK actually emitted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { signedUrl: "wss://x" } }))));
    render(<LiveTest agentId="a" agentName="Desk" />);
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Start conversation/ }));
    await waitFor(() => expect(sdk.opts).toBeDefined());
    act(() => { sdk.opts!.onMessage!({ message: "Hello, this is Desk.", role: "agent" }); sdk.opts!.onMessage!({ message: "Hi, I need help", role: "user" }); });
    expect(await screen.findByText("Hello, this is Desk.")).toBeInTheDocument();
    expect(screen.getByText("Hi, I need help")).toBeInTheDocument();
  });

  it("reports a failed session request and starts no SDK session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "elevenlabs_permission_denied", message: "The API key lacks permission for this operation." } }), { status: 502 })));
    render(<LiveTest agentId="a" agentName="Desk" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Start conversation/ }));
    expect(await screen.findByText("The API key lacks permission for this operation.")).toBeInTheDocument();
    expect(sdk.startSession).not.toHaveBeenCalled();
  });

  it("reports microphone unavailability without contacting the server", async () => {
    setMic(false);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<LiveTest agentId="a" agentName="Desk" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Start conversation/ }));
    expect(await screen.findByText(/cannot access a microphone/)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });

  it("surfaces SDK connection errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { signedUrl: "wss://x" } }))));
    render(<LiveTest agentId="a" agentName="Desk" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Start conversation/ }));
    await waitFor(() => expect(sdk.opts).toBeDefined());
    act(() => sdk.opts!.onError!("Microphone permission denied"));
    expect(await screen.findByText("Microphone permission denied")).toBeInTheDocument();
  });

  it("offers end and mute controls only while a session is active", () => {
    sdk.state = { status: "connected", isSpeaking: true, isMuted: false };
    vi.stubGlobal("fetch", vi.fn());
    render(<LiveTest agentId="a" agentName="Desk" />);
    expect(screen.getByRole("button", { name: /End conversation/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mute microphone/ })).toBeInTheDocument();
    expect(screen.getByText(/Agent is speaking/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start conversation/ })).not.toBeInTheDocument();
  });
});
