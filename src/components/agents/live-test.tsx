"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, MicOff, PhoneOff, Volume2, Sparkles } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";
import { VoiceOrb, LiveWaveform, type AgentVoiceState } from "@/components/ui/voice-orb";

interface Line {
  id: number;
  role: "user" | "agent";
  text: string;
}

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
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a microphone. Use a current browser over HTTPS or localhost.");
      return;
    }
    setStarting(true);
    try {
      const { signedUrl } = await api<{ signedUrl: string }>(`/api/agents/${agentId}/session`, {
        method: "POST",
      });
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
    } finally {
      setStarting(false);
    }
  }

  // Derive genuine ElevenLabs voice state for Orb
  const orbState: AgentVoiceState = React.useMemo(() => {
    if (error) return "error";
    if (status === "connecting" || starting) return "connecting";
    if (status === "connected") {
      return isSpeaking ? "speaking" : "listening";
    }
    return "idle";
  }, [error, status, starting, isSpeaking]);

  const labels: Record<string, string> = {
    connected: "Live Session Active",
    connecting: "Connecting to ElevenLabs...",
    disconnecting: "Ending Session...",
    disconnected: "Ready to Test",
    error: "Connection Error",
  };
  const label = labels[status] ?? status;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left / Top: Interactive ElevenLabs Voice Testing Stage */}
      <div className="lg:col-span-5 space-y-4">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-b from-surface via-surface to-subtle/30 shadow-xs">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-foreground/80" />
                <CardTitle>Voice Agent Studio</CardTitle>
              </div>
              <Badge
                tone={
                  status === "connected"
                    ? "success"
                    : status === "connecting"
                    ? "warning"
                    : "neutral"
                }
              >
                {label}
              </Badge>
            </div>
          </CardHeader>

          <CardBody className="flex flex-col items-center justify-center py-8 text-center space-y-6">
            {/* Authentic Audio-Reactive Orb */}
            <div className="py-2">
              <VoiceOrb state={orbState} size="lg" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{agentName}</h3>
              <p className="text-xs text-muted max-w-xs">
                {status === "connected"
                  ? isSpeaking
                    ? "Agent is speaking. You can speak to interrupt."
                    : "Listening... speak into your microphone."
                  : "Direct low-latency WebSocket connection to ElevenLabs Conversational AI."}
              </p>
            </div>

            {/* Live Audio Waveform when active */}
            <div className="h-6 flex items-center justify-center">
              <LiveWaveform active={status === "connected"} barCount={24} />
            </div>

            {error && (
              <div className="w-full text-left">
                <Alert tone="danger" title="Session Problem">
                  {error}
                </Alert>
              </div>
            )}

            {/* Tactile Control Buttons with Accessible Labels */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {!active ? (
                <Button onClick={start} loading={starting} size="lg" className="px-6">
                  <Mic className="h-4 w-4 mr-1.5" aria-hidden />
                  Start conversation
                </Button>
              ) : (
                <>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={() => conversation.endSession()}
                  >
                    <PhoneOff className="h-4 w-4 mr-1.5" aria-hidden />
                    End conversation
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setMuted(!isMuted)}
                    aria-pressed={isMuted}
                  >
                    {isMuted ? (
                      <MicOff className="h-4 w-4 mr-1.5 text-danger" aria-hidden />
                    ) : (
                      <Mic className="h-4 w-4 mr-1.5" aria-hidden />
                    )}
                    {isMuted ? "Unmute microphone" : "Mute microphone"}
                  </Button>
                </>
              )}
            </div>

            <p className="text-[11px] text-muted/70 max-w-xs leading-relaxed">
              Audio streams bi-directionally over WebSockets. Real audio hardware test with your ElevenLabs voice quota.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Right: Live Transcript & Interaction Log */}
      <div className="lg:col-span-7">
        <Card className="h-full min-h-[440px] flex flex-col border-border/70 shadow-xs">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center justify-between w-full">
              <CardTitle>Transcript</CardTitle>
              <span className="text-[11px] font-mono text-muted">
                {lines.length} turn{lines.length === 1 ? "" : "s"}
              </span>
            </div>
          </CardHeader>
          <CardBody className="flex-1 p-5 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted space-y-2">
                <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-muted" />
                </div>
                <p className="text-xs font-medium text-foreground">Nothing yet.</p>
                <p className="text-xs text-muted max-w-sm">
                  Messages appear here as the conversation happens.
                </p>
              </div>
            ) : (
              <ol aria-live="polite" className="space-y-3.5">
                {lines.map((l) => (
                  <li
                    key={l.id}
                    className={`flex flex-col ${l.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <span className="mb-1 text-[11px] font-medium text-muted">
                      {l.role === "user" ? "You" : agentName}
                    </span>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        l.role === "user"
                          ? "bg-foreground text-background font-medium rounded-br-xs"
                          : "bg-subtle text-foreground border border-border/70 rounded-bl-xs shadow-xs"
                      }`}
                    >
                      {l.text}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function LiveTest(props: { agentId: string; agentName: string }) {
  return (
    <ConversationProvider>
      <Session {...props} />
    </ConversationProvider>
  );
}
