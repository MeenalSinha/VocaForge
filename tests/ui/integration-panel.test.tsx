// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsStatusPanel } from "@/components/integration-card";
import type { IntegrationStatus } from "@/server/integrations/elevenlabs";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const base = { checkedAt: null, baseUrl: "https://api.elevenlabs.io" };

describe("ElevenLabsStatusPanel", () => {
  it("shows not configured with the check disabled, and never a connected badge", () => {
    const s: IntegrationStatus = { ...base, state: "not_configured", message: "ELEVENLABS_API_KEY is not set." };
    render(<ElevenLabsStatusPanel initial={s} />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run connection check/ })).toBeDisabled();
  });

  it("calls the server check and renders the state it returns", async () => {
    const result: IntegrationStatus = { ...base, state: "auth_failed", message: "ElevenLabs rejected the configured API key.", checkedAt: "2026-10-28T10:00:00.000Z" };
    const f = vi.fn(async () => new Response(JSON.stringify({ data: result }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    render(<ElevenLabsStatusPanel initial={{ ...base, state: "unverified", message: "Not verified." }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Run connection check/ }));
    await waitFor(() => expect(screen.getByText("Authentication failed")).toBeInTheDocument());
    expect(f).toHaveBeenCalledWith("/api/integrations/elevenlabs/check", expect.objectContaining({ method: "POST" }));
  });

  it("shows an error message when the check request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<ElevenLabsStatusPanel initial={{ ...base, state: "unverified", message: "Not verified." }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Run connection check/ }));
    await waitFor(() => expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument());
  });
});
