import type { Metadata } from "next";
import { ElevenLabsStatusPanel } from "@/components/integration-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { loadConfig } from "@/server/config/env";
import { appliedMigrations, pendingMigrations } from "@/server/db/migrate";
import { checkDatabase, getPool } from "@/server/db/pool";
import { configuredStatus } from "@/server/integrations/elevenlabs";

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
        title="Settings"
        description="Service connections and server configuration. Secrets are read from the server environment and are never shown here."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>ElevenLabs</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <ElevenLabsStatusPanel initial={configuredStatus()} />
            <Alert title="How to configure">
              Set <code className="font-mono text-xs">ELEVENLABS_API_KEY</code> in <code className="font-mono text-xs">.env.local</code> (or your host&apos;s secret store) and restart the server.
              Keys are not entered in the browser because the app has no secure secret storage yet.
            </Alert>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Configuration generation</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>Provider: {config.generation.provider}{config.generation.model ? `, model ${config.generation.model}` : ""}</span>
              {config.generation.configured ? <Badge tone="success">Configured</Badge> : <Badge tone="warning">Not configured</Badge>}
            </div>
            <p className="text-xs text-muted">{config.generation.configured ? "Key and model are set. Connectivity is verified the first time you generate a configuration; no test request is sent from this page." : "Set ANTHROPIC_API_KEY and GENERATION_MODEL on the server to turn on prompt-to-agent generation."}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Server configuration</CardTitle></CardHeader>
          <CardBody>
            <dl className="divide-y text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt>Database connection</dt>
                <dd>{db.ok ? <Badge tone="success">Connected</Badge> : <Badge tone="danger">Unavailable</Badge>}</dd>
              </div>
              {!db.ok && <div className="py-2.5 text-muted">{db.error}</div>}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt>Database migrations</dt>
                <dd>{pending === null ? <Badge>Unknown</Badge> : pending.length === 0 ? <Badge tone="success">Up to date</Badge> : <Badge tone="warning">{pending.length} pending: run npm run db:migrate</Badge>}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt>Access control</dt>
                <dd>{config.access.tokenConfigured ? <Badge tone="success">Access token required</Badge> : <Badge tone="warning">No access token</Badge>}</dd>
              </div>
              {config.issues.map((i) => (
                <div key={i.key} className="py-2.5 text-danger">Invalid {i.key}: {i.message}</div>
              ))}
            </dl>
            {!config.access.tokenConfigured && (
              <Alert tone="warning" className="mt-4" title="Anyone who can reach this server can use it">
                Phase 1 has no user accounts. Set VOCAFORGE_ACCESS_TOKEN before exposing the app beyond your own machine.
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
