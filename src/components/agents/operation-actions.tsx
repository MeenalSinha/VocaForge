"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

export function OperationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function run(kind: "reconcile" | "dismiss") {
    setBusy(kind);
    try {
      await api(`/api/agents/operations/${id}/${kind}`, { method: "POST" });
      toast.success(kind === "reconcile" ? "Agent saved to VocaForge" : "Dismissed");
      router.refresh();
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "The action failed."); } finally { setBusy(null); }
  }
  return (
    <div className="flex gap-2">
      {status === "remote_created" && <Button size="sm" onClick={() => run("reconcile")} loading={busy === "reconcile"}>Save to VocaForge</Button>}
      {status !== "remote_created" && <Button size="sm" variant="secondary" onClick={() => run("dismiss")} loading={busy === "dismiss"}>I checked, dismiss</Button>}
    </div>
  );
}
