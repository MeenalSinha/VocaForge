"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";

interface Line { id: number; role: "user" | "agent"; text: string }

function Session({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const seq = React.useRef(0);
  const conversation = useConversation();
  const { status, isSpeaking, isMuted, setMuted } = conversation;
  const active = status === "connected" || status === "connecting";

  async function start() {
    setError(null);
    setLines([]);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setError("This browser cannot access a microphone. Use a current browser over HTTPS or localhost."); return; }
    setStarting(true);
    try {
      const { signedUrl } = await api<{ signedUrl: string }>(`/api/agents/${agentId}/session`, { method: "POST" });
      conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        onMessage: (m: { message: string; role?: string; source?: string }) => {
          const role = m.role === "user" || m.source === "user" ? "user" : "agent";
          setLines((l) => [...l, { id: ++seq.current, role, text: m.message }]);
        },
        onError: (message: string) => setError(message || "The connection failed."),
        onDisconnect: () => undefined,
      } as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The session could not be started.");
    } finally { setStarting(false); }
  }

  const labels: Record<string, string> = { connected: "Connected", connecting: "Connecting", disconnecting: "Ending", disconnected: "Not connected", error: "Connection error" };
  const label = labels[status] ?? status;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Live conversation with {agentName}</CardTitle><Badge tone={status === "connected" ? "success" : status === "connecting" ? "warning" : "neutral"}>{label}</Badge></CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">Your browser will ask for microphone access. Audio goes directly between your browser and ElevenLabs. The conversation uses your ElevenLabs credits. This transcript lives only on this page and is not saved by VocaForge.</p>
          {error && <Alert tone="danger" title="Session problem">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-2">
            {!active ? (
              <Button onClick={start} loading={starting}><Mic className="h-4 w-4" aria-hidden />Start conversation</Button>
            ) : (
              <>
                <Button variant="danger" onClick={() => conversation.endSession()}><PhoneOff className="h-4 w-4" aria-hidden />End conversation</Button>
                <Button variant="secondary" onClick={() => setMuted(!isMuted)} aria-pressed={isMuted}>{isMuted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}{isMuted ? "Unmute microphone" : "Mute microphone"}</Button>
              </>
            )}
            {status === "connected" && <span role="status" className="text-sm text-muted">{isSpeaking ? "Agent is speaking. You can interrupt." : "Listening"}</span>}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
        <CardBody>
          {lines.length === 0 ? <p className="text-sm text-muted">Nothing yet. Messages appear here as the conversation happens.</p> : (
            <ol aria-live="polite" className="space-y-2">
              {lines.map((l) => <li key={l.id} className={l.role === "user" ? "text-right" : ""}><span className="mb-0.5 block text-xs text-muted">{l.role === "user" ? "You" : agentName}</span><span className={`inline-block rounded-md px-3 py-1.5 text-sm ${l.role === "user" ? "bg-accent-soft" : "bg-subtle"}`}>{l.text}</span></li>)}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function LiveTest(props: { agentId: string; agentName: string }) {
  return <ConversationProvider><Session {...props} /></ConversationProvider>;
}
