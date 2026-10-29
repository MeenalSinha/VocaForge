import { describe, expect, it } from "vitest";
import { redact, redactString } from "@/server/logger";

describe("logger redaction", () => {
  it("redacts sensitive keys, including nested ones", () => {
    const out = redact({ apiKey: "sk_abc", nested: { Authorization: "Bearer x", ok: 1 }, DATABASE_URL: "postgresql://u:p@h/d" }) as Record<string, unknown>;
    expect(out.apiKey).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).Authorization).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(out.DATABASE_URL).toBe("[redacted]");
  });
  it("scrubs credentials embedded in connection strings inside messages", () => {
    expect(redactString("connect postgresql://user:hunter2@host:5432/db failed")).not.toContain("hunter2");
  });
});
