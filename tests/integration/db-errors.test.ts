import { describe, expect, it } from "vitest";
import { checkDatabase, mapDbError, withTransaction } from "@/server/db/pool";
import { ConflictError, DatabaseUnavailableError } from "@/server/errors";
import { createProject, getDashboardData } from "@/server/projects/service";

const refused = () => Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
// Test double: a store whose database is down.
const downStore = { connect: async () => { throw refused(); }, query: async () => { throw refused(); } } as never;

describe("database failures", () => {
  it("maps connection errors to DatabaseUnavailableError", () => {
    expect(() => mapDbError(refused())).toThrow(DatabaseUnavailableError);
    expect(() => mapDbError(Object.assign(new Error("x"), { code: "57P01" }))).toThrow(DatabaseUnavailableError);
  });
  it("maps unique violations to ConflictError and rethrows unknown errors", () => {
    expect(() => mapDbError({ code: "23505", constraint: "projects_active_name_unique" })).toThrow(ConflictError);
    expect(() => mapDbError(new Error("boom"))).toThrow("boom");
  });
  it("surfaces unavailability from service calls instead of crashing", async () => {
    await expect(createProject({ name: "x" }, { store: downStore })).rejects.toBeInstanceOf(DatabaseUnavailableError);
    await expect(getDashboardData({ store: downStore })).rejects.toBeInstanceOf(DatabaseUnavailableError);
  });
  it("rolls back and rethrows when work inside a transaction fails", async () => {
    const calls: string[] = [];
    const pool = { connect: async () => ({ query: async (q: string) => { calls.push(q); }, release: () => calls.push("release") }) } as never;
    await expect(withTransaction(pool, async () => { throw new Error("inner"); })).rejects.toThrow("inner");
    expect(calls).toEqual(["BEGIN", "ROLLBACK", "release"]);
  });
  it("checkDatabase reports a failed query honestly and hides driver details", async () => {
    const r = await checkDatabase(() => downStore);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("127.0.0.1");
  });
  it("checkDatabase reports success only after a real query", async () => {
    let ran = "";
    expect(await checkDatabase(() => ({ query: async (q: string) => { ran = q; return {}; } }) as never)).toEqual({ ok: true });
    expect(ran).toBe("SELECT 1");
  });
});
