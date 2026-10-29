import type { Metadata } from "next";
import { ElevenLabsStatusPanel } from "@/components/integration-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { loadConfig } from "@/server/config/env";
import { appliedMigrations, pendingMigrations } from "@/server/db/migrate";
import { checkDatabase, getPool } from "@/server/db/pool";
import { configuredStatus } from "@/server/integrations/elevenlabs";
import { Bot, Database, KeyRound, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = loadConfig();
  const db = await checkDatabase();
  let pending: string[] | null = null;
  if (db.ok) {
    try {
      pending = pendingMigrations(await appliedMigrations(getPool()));
    } catch {
      pending = null;
    }
  }

  return (
    <>
      <PageHeader
        title="System Settings"
        description="Manage ElevenLabs API connectivity, model provider credentials, PostgreSQL storage, and application access tokens."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      />

      <div className="space-y-6">
        {/* ElevenLabs Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded bg-accent-soft text-accent">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>ElevenLabs Conversational AI</CardTitle>
                <CardDescription>
                  Powers voice agent synchronization, realistic voice generation, and live audio testing.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <ElevenLabsStatusPanel initial={configuredStatus()} />
            <Alert title="Configuration Protocol">
              Set <code className="font-mono text-xs font-semibold">ELEVENLABS_API_KEY</code> in{" "}
              <code className="font-mono text-xs font-semibold">.env.local</code> and restart the server. VocaForge reads
              API credentials strictly on the server to prevent browser leakage.
            </Alert>
          </CardBody>
        </Card>

        {/* AI Provider */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded bg-accent-soft text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>AI Configuration & Synthesis Engine</CardTitle>
                <CardDescription>
                  Powers automated voice agent prompt drafting, persona generation, and failure fix synthesis.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm rounded-md border border-border/60 bg-subtle/30 p-3">
              <div>
                <span className="font-medium text-foreground">
                  Provider: {config.generation.provider.toUpperCase()}
                </span>
                {config.generation.model && (
                  <span className="ml-2 font-mono text-xs text-muted">
                    ({config.generation.model})
                  </span>
                )}
              </div>
              {config.generation.configured ? (
                <Badge tone="success">Configured & Active</Badge>
              ) : (
                <Badge tone="warning">Not Configured</Badge>
              )}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {config.generation.configured
                ? `${config.generation.provider === "groq" ? "Groq" : "Anthropic"} API credentials and target model are validated. Used for automated agent prompt generation and structured diff repairs.`
                : "Set GROQ_API_KEY (or ANTHROPIC_API_KEY) and GENERATION_MODEL in .env.local to enable AI-assisted persona synthesis and failure remediation."}
            </p>
          </CardBody>
        </Card>

        {/* Database & Infrastructure */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded bg-accent-soft text-accent">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Database Infrastructure</CardTitle>
                <CardDescription>
                  PostgreSQL connection pooling, transactional state, and schema migrations.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-medium text-foreground">Connection Status</dt>
                <dd>
                  {db.ok ? (
                    <Badge tone="success">Connected (PostgreSQL)</Badge>
                  ) : (
                    <Badge tone="danger">Connection Failed</Badge>
                  )}
                </dd>
              </div>
              {!db.ok && <div className="py-2.5 text-xs text-danger font-mono">{db.error}</div>}

              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-medium text-foreground">Schema Migrations</dt>
                <dd>
                  {pending === null ? (
                    <Badge tone="neutral">Unknown State</Badge>
                  ) : pending.length === 0 ? (
                    <Badge tone="success">Up to Date (6/6 Applied)</Badge>
                  ) : (
                    <Badge tone="warning">
                      {pending.length} Pending (run npm run db:migrate)
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-medium text-foreground">Network SSL Mode</dt>
                <dd className="font-mono text-xs text-muted">{config.database.ssl}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Security & Access Gate */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded bg-accent-soft text-accent">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Security & Access Control</CardTitle>
                <CardDescription>
                  HTTP Basic Authentication and environment gate settings.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-medium text-foreground">Access Gate</dt>
                <dd>
                  {config.access.tokenConfigured ? (
                    <Badge tone="success">Token Enforced</Badge>
                  ) : (
                    <Badge tone="neutral">Open Access (Dev Mode)</Badge>
                  )}
                </dd>
              </div>
              {config.issues.map((i) => (
                <div key={i.key} className="py-2.5 text-xs text-danger">
                  Invalid configuration for {i.key}: {i.message}
                </div>
              ))}
            </dl>

            {!config.access.tokenConfigured && (
              <Alert tone="warning" className="mt-4" title="Development Environment Notice">
                No access token is currently set. The application is open for local development. Set{" "}
                <code className="font-mono text-xs font-semibold">VOCAFORGE_ACCESS_TOKEN</code> in your environment before exposing VocaForge to a public network.
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
