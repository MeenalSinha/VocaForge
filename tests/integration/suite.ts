import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { listRecentActivity } from "@/server/activity/repository";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import {
  archiveProject, createProject, getDashboardData, getProject, listProjects, restoreProject, updateProject,
} from "@/server/projects/service";

/** Behaviour every database backing the service must satisfy (pg-mem in CI, real PostgreSQL opt-in). */
export function projectServiceSuite(getStore: () => Pool) {
  const c = () => ({ store: getStore() });
  const uniq = () => `p-${Math.random().toString(36).slice(2, 10)}`;

  describe("project service", () => {
    it("creates a project and reads it back with a database-generated id", async () => {
      const name = uniq();
      const created = await createProject({ name: ` ${name} `, description: "for tests" }, c());
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created).toMatchObject({ name, description: "for tests", status: "active" });
      expect(await getProject(created.id, c())).toEqual(created);
    });

    it("rejects invalid input with field errors", async () => {
      const err = await createProject({ name: "  " }, c()).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.fieldErrors.name[0]).toMatch(/required/i);
    });

    it("lists, searches (case-insensitively) and treats LIKE wildcards literally", async () => {
      const tag = uniq();
      await createProject({ name: `Alpha ${tag}`, description: "dental front desk" }, c());
      await createProject({ name: `Beta ${tag}` }, c());
      expect((await listProjects({ q: `ALPHA ${tag}` }, c())).items).toHaveLength(1);
      expect((await listProjects({ q: "front desk" }, c())).items.length).toBeGreaterThanOrEqual(1);
      expect((await listProjects({ q: "%" }, c())).items).toHaveLength(0);
      expect((await listProjects({ q: "_" }, c())).items).toHaveLength(0);
    });

    it("updates fields, persists them and moves updatedAt forward", async () => {
      const p = await createProject({ name: uniq() }, c());
      await new Promise((r) => setTimeout(r, 15));
      const next = uniq();
      const updated = await updateProject(p.id, { name: next, description: "changed" }, c());
      expect(updated.name).toBe(next);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(p.updatedAt).getTime());
      expect(await getProject(p.id, c())).toMatchObject({ name: next, description: "changed" });
    });

    it("archives and restores without deleting", async () => {
      const p = await createProject({ name: uniq() }, c());
      expect((await archiveProject(p.id, c())).status).toBe("archived");
      expect((await listProjects({ status: "active", q: p.name }, c())).items).toHaveLength(0);
      expect((await listProjects({ status: "archived", q: p.name }, c())).items).toHaveLength(1);
      expect((await getProject(p.id, c())).status).toBe("archived");
      expect((await restoreProject(p.id, c())).status).toBe("active");
    });

    it("enforces unique active names case-insensitively, and frees the name on archive", async () => {
      const name = uniq();
      const first = await createProject({ name }, c());
      const err = await createProject({ name: name.toUpperCase() }, c()).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictError);
      await archiveProject(first.id, c());
      await expect(createProject({ name }, c())).resolves.toMatchObject({ name });
    });

    it("returns NotFound for unknown and malformed ids", async () => {
      await expect(getProject("00000000-0000-4000-8000-000000000000", c())).rejects.toBeInstanceOf(NotFoundError);
      await expect(getProject("not-a-uuid", c())).rejects.toBeInstanceOf(NotFoundError);
      await expect(updateProject("00000000-0000-4000-8000-000000000000", { name: "x" }, c())).rejects.toBeInstanceOf(NotFoundError);
    });

    it("scopes every operation by owner", async () => {
      const a = { store: getStore(), ownerId: "user-a" };
      const b = { store: getStore(), ownerId: "user-b" };
      const mine = await createProject({ name: uniq() }, a);
      await expect(getProject(mine.id, b)).rejects.toBeInstanceOf(NotFoundError);
      await expect(updateProject(mine.id, { name: "hijack" }, b)).rejects.toBeInstanceOf(NotFoundError);
      await expect(archiveProject(mine.id, b)).rejects.toBeInstanceOf(NotFoundError);
      expect((await listProjects({ q: mine.name }, b)).items).toHaveLength(0);
      expect((await listProjects({ q: mine.name }, a)).items).toHaveLength(1);
    });

    it("records persisted activity and exposes real counts", async () => {
      const ctx = { store: getStore(), ownerId: `owner-${uniq()}` };
      expect(await getDashboardData(ctx)).toEqual({ counts: { active: 0, archived: 0 }, agents: 0, activity: [] });
      const p = await createProject({ name: uniq() }, ctx);
      await updateProject(p.id, { description: "x" }, ctx);
      const p2 = await createProject({ name: uniq() }, ctx);
      await archiveProject(p2.id, ctx);
      const d = await getDashboardData(ctx);
      expect(d.counts).toEqual({ active: 1, archived: 1 });
      expect(d.activity.map((a) => a.type).sort()).toEqual(["project.archived", "project.created", "project.created", "project.updated"]);
      expect((await listRecentActivity(getStore(), ctx.ownerId, 2))).toHaveLength(2);
    });
  });
}
