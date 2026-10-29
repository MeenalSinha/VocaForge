"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import { createProjectSchema } from "@/server/projects/schema";

export function CreateProjectDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "") };
    const check = createProjectSchema.safeParse(input);
    if (!check.success) {
      const fe: Record<string, string[]> = {};
      for (const i of check.error.issues) (fe[String(i.path[0])] ??= []).push(i.message);
      setErrors(fe);
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const project = await api<{ id: string }>("/api/projects", { method: "POST", json: input });
      toast.success("Project created");
      setOpen(false);
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError(err instanceof ApiError ? err.message : "The project could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" aria-hidden />New project</Button></DialogTrigger>
      <DialogContent title="Create project" description="Give the project a name. You can add agents and tests to it in later phases.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger" title="Could not create the project">{formError}</Alert>}
          <Field id="project-name" label="Name" error={errors.name?.[0]}>
            {(a) => <Input {...a} name="name" maxLength={120} autoFocus required />}
          </Field>
          <Field id="project-description" label="Description (optional)" hint="What this project is for." error={errors.description?.[0]}>
            {(a) => <Textarea {...a} name="description" maxLength={2000} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>Create project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
