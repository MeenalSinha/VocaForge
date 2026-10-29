"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import { createProjectSchema, type Project } from "@/server/projects/schema";

export function ProjectEditForm({ project }: { project: Project }) {
  const router = useRouter();
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
      await api(`/api/projects/${project.id}`, { method: "PATCH", json: input });
      toast.success("Changes saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError(err instanceof ApiError ? err.message : "The changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError && <Alert tone="danger" title="Could not save changes">{formError}</Alert>}
      <Field id="edit-name" label="Name" error={errors.name?.[0]}>
        {(a) => <Input {...a} name="name" defaultValue={project.name} maxLength={120} required />}
      </Field>
      <Field id="edit-description" label="Description" error={errors.description?.[0]}>
        {(a) => <Textarea {...a} name="description" defaultValue={project.description ?? ""} maxLength={2000} />}
      </Field>
      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  );
}
