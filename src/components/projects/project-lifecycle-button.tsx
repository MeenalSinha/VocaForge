"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";

export function ProjectLifecycleButton({ id, name, status }: { id: string; name: string; status: "active" | "archived" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const archiving = status === "active";

  async function run() {
    setBusy(true);
    try {
      await api(`/api/projects/${id}/${archiving ? "archive" : "restore"}`, { method: "POST" });
      toast.success(archiving ? "Project archived" : "Project restored");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {archiving ? <Archive className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
        {archiving ? "Archive" : "Restore"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={archiving ? `Archive "${name}"?` : `Restore "${name}"?`}
        description={archiving ? "The project is hidden from the default list. Nothing is deleted and you can restore it later." : "The project returns to the active list."}
        confirmLabel={archiving ? "Archive project" : "Restore project"}
        onConfirm={run}
        loading={busy}
        destructive={archiving}
      />
    </>
  );
}
