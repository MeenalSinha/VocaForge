"use client";

import * as React from "react";
import { Field, Input, Textarea } from "@/components/ui/form";

const toLines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

/** Edits a string list as one item per line while keeping blank lines the user is still typing. */
export function LinesField({ id, label, hint, error, value, onChange, rows = 3 }: { id: string; label: string; hint?: string; error?: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = React.useState(value.join("\n"));
  React.useEffect(() => {
    setText((t) => (JSON.stringify(toLines(t)) === JSON.stringify(value) ? t : value.join("\n")));
  }, [value]);
  return (
    <Field id={id} label={label} hint={hint ?? "One item per line."} error={error}>
      {(a) => <Textarea {...a} rows={rows} value={text} onChange={(e) => { setText(e.target.value); onChange(toLines(e.target.value)); }} />}
    </Field>
  );
}

export function CodesField({ id, label, hint, error, value, onChange }: { id: string; label: string; hint?: string; error?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = React.useState(value.join(", "));
  React.useEffect(() => {
    setText((t) => (JSON.stringify(t.split(",").map((x) => x.trim()).filter(Boolean)) === JSON.stringify(value) ? t : value.join(", ")));
  }, [value]);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(a) => <Input {...a} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean)); }} />}
    </Field>
  );
}
