import { describe, expect, it } from "vitest";
import { createProjectSchema, listProjectsSchema, updateProjectSchema } from "@/server/projects/schema";

describe("project schemas", () => {
  it("trims the name and normalises an empty description to null", () => {
    expect(createProjectSchema.parse({ name: "  Clinic  ", description: "  " })).toEqual({ name: "Clinic", description: null });
  });
  it("rejects blank and over-long names", () => {
    expect(createProjectSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });
  it("rejects an over-long description", () => {
    expect(createProjectSchema.safeParse({ name: "a", description: "x".repeat(2001) }).success).toBe(false);
  });
  it("requires at least one field to update", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ description: "" }).success).toBe(true);
  });
  it("applies list defaults and bounds", () => {
    expect(listProjectsSchema.parse({})).toMatchObject({ status: "active", limit: 50, offset: 0 });
    expect(listProjectsSchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listProjectsSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});
