import { Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/**
 * Honest placeholder for a section that belongs to a later phase.
 * Renders no data, no fake activity and no controls for unsupported operations.
 */
export function FutureFeature({
  title,
  purpose,
  phase,
  capabilities,
  dependsOn,
}: {
  title: string;
  purpose: string;
  phase: number;
  capabilities: string[];
  dependsOn: string;
}) {
  return (
    <>
      <PageHeader title={title} description={purpose} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: title }]} actions={<Badge tone="warning">Planned for Phase {phase}</Badge>} />
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-muted" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">This section is not implemented yet.</p>
              <p className="text-sm text-muted">{dependsOn}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">What will live here</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {capabilities.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button asChild><Link href="/projects">Go to projects</Link></Button>
            <Button asChild variant="secondary"><Link href="/dashboard">Back to dashboard</Link></Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
