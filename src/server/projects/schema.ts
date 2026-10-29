import { z } from "zod";

export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 2000;

const name = z
  .string("Name is required.")
  .trim()
  .min(1, "Name is required.")
  .max(PROJECT_NAME_MAX, `Name must be ${PROJECT_NAME_MAX} characters or fewer.`);

const description = z
  .string()
  .trim()
  .max(PROJECT_DESCRIPTION_MAX, `Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer.`)
  .nullish()
  .transform((v) => (v ? v : null));

export const createProjectSchema = z.object({ name, description });

export const updateProjectSchema = z
  .object({ name: name.optional(), description: description.optional() })
  .refine((v) => v.name !== undefined || v.description !== undefined, { message: "Provide a field to update." });

export const listProjectsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const uuidSchema = z.string().uuid();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
