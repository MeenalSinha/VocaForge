"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Presentation, CheckCircle2, PlayCircle, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface DemoStatus {
  initialized: boolean;
  projectId?: string;
  projectName?: string;
  agentsCount?: number;
  personasCount?: number;
  scenariosCount?: number;
  agents?: Array<{ id: string; name: string; remoteAgentId: string }>;
}

export function DemoSetupCard() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withSimulation, setWithSimulation] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/demo-setup");
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data);
      }
    } catch {
      // Ignore network errors on init
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleSetup() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/demo-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executeSimulation: withSimulation }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Demo initialization failed");
      }
      toast.success("Demo workspace successfully initialized!");
      await fetchStatus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded bg-accent-soft text-accent">
              <Presentation className="h-4 w-4" />
            </div>
            <div>
              <CardTitle>Presentation Demo Workspace</CardTitle>
              <CardDescription>
                Idempotently populate a realistic, presentation-ready workspace with ElevenLabs voice agents, virtual customers, and adversarial scenarios.
              </CardDescription>
            </div>
          </div>
          {status?.initialized ? (
            <Badge tone="success" className="gap-1.5 py-1">
              <CheckCircle2 className="h-3 w-3" />
              Demo Ready
            </Badge>
          ) : (
            <Badge tone="neutral">Uninitialized</Badge>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Checking demo workspace status...</span>
          </div>
        ) : status?.initialized ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border/70 bg-subtle/50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Project:</span>
                <span className="font-medium text-foreground">{status.projectName}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Active Voice Agents (ElevenLabs):</span>
                <span className="font-medium text-foreground">{status.agentsCount} agents</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Virtual Customers:</span>
                <span className="font-medium text-foreground">{status.personasCount} personas</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Test Scenarios:</span>
                <span className="font-medium text-foreground">{status.scenariosCount} scenarios</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href={`/projects/${status.projectId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm"
              >
                <span>Open Demo Project</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/test-lab"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-subtle transition-colors"
              >
                <span>Launch in Test Lab</span>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetup}
                disabled={submitting}
                className="text-xs ml-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Re-verifying...
                  </>
                ) : (
                  "Re-sync Demo State"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              Initializes <strong>Apex Care &amp; Support Services</strong> with 2 real ElevenLabs voice agents, 4 customer personas (appointment rescheduling, billing inquiries, bilingual Spanish evaluation, and refund escalation), and pre-configured adversarial test scenarios.
            </p>

            <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer">
              <input
                type="checkbox"
                checked={withSimulation}
                onChange={(e) => setWithSimulation(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              <span>Also execute a live ElevenLabs simulation and generate AI root-cause analysis</span>
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={handleSetup} disabled={submitting} size="sm" className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Setting up workspace...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-3.5 w-3.5" />
                    Initialize Presentation Workspace
                  </>
                )}
              </Button>
              <span className="text-[11px] text-muted">Or run <code className="font-mono bg-subtle px-1 py-0.5 rounded">npm run demo:setup</code></span>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
