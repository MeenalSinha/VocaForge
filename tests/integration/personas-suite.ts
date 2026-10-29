import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createProject } from "@/server/projects/service";
import {
  archivePersona,
  archiveScenario,
  createPersona,
  createScenario,
  deletePersona,
  deleteScenario,
  duplicatePersona,
  duplicateScenario,
  getPersona,
  getPersonaStats,
  getScenario,
  listPersonas,
  updatePersona,
  updateScenario,
} from "@/server/personas/service";
import { emptyPersonaConfig, emptyScenarioConfig } from "@/server/personas/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export function personaServiceSuite(getStore: () => Pool) {
  let projectId: string;
  const ownerId = "test-owner-uuid-1";

  const ctx = (owner: string | null = ownerId) => ({ store: getStore(), ownerId: owner });

  describe("Persona & Scenario Service Suite", () => {
    it("initializes project for persona tests", async () => {
      const project = await createProject(
        { name: `Persona Test Workspace ${Date.now()}`, description: "Integration workspace" },
        ctx(),
      );
      projectId = project.id;
      expect(projectId).toBeDefined();
    });

    describe("Persona CRUD & Lifecycle", () => {
      it("creates a persona and evaluates its readiness", async () => {
        const config = emptyPersonaConfig();
        config.personality.traits = ["impatient", "busy"];
        config.personality.communicationStyle = "Fast and clipped";
        config.startingContext.situation = "Wants an invoice breakdown";
        config.defaultObjective.intent = "Get line-item clarity";

        const { persona, readiness } = await createPersona(
          {
            projectId,
            name: "Marcus Vance",
            description: "Busy CFO calling between meetings",
            category: "customer_experience",
            config,
          },
          ctx(),
        );

        expect(persona.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(persona.name).toBe("Marcus Vance");
        expect(persona.category).toBe("customer_experience");
        expect(persona.status).toBe("ready_for_testing");
        expect(readiness.isReady).toBe(true);

        // Read back
        const read = await getPersona(persona.id, ctx());
        expect(read.persona.name).toBe("Marcus Vance");
        expect(read.scenarioCount).toBe(0);
      });

      it("rejects invalid persona creation inputs", async () => {
        await expect(
          createPersona(
            {
              projectId,
              name: "   ",
              category: "customer_experience",
              config: emptyPersonaConfig(),
            },
            ctx(),
          ),
        ).rejects.toBeInstanceOf(ValidationError);
      });

      it("updates persona configuration and metadata", async () => {
        const created = await createPersona(
          {
            projectId,
            name: "Original Name",
            category: "support",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        const updated = await updatePersona(
          created.persona.id,
          {
            name: "Updated Name",
            description: "New updated description",
            category: "pricing_policies",
          },
          ctx(),
        );

        expect(updated.persona.name).toBe("Updated Name");
        expect(updated.persona.category).toBe("pricing_policies");
        expect(updated.persona.description).toBe("New updated description");
      });

      it("duplicates a persona with '(Copy)' suffix and fresh version", async () => {
        const { persona } = await createPersona(
          {
            projectId,
            name: "Source Persona",
            category: "communication",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        const copy = await duplicatePersona(persona.id, ctx());
        expect(copy.persona.id).not.toBe(persona.id);
        expect(copy.persona.name).toBe("Source Persona (Copy)");
        expect(copy.persona.category).toBe("communication");
        expect(copy.persona.version).toBe(1);
      });

      it("archives a persona without hard deleting it", async () => {
        const { persona } = await createPersona(
          {
            projectId,
            name: "To Archive",
            category: "custom",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        const archived = await archivePersona(persona.id, ctx());
        expect(archived.status).toBe("archived");

        const read = await getPersona(persona.id, ctx());
        expect(read.persona.status).toBe("archived");
        expect(read.readiness.status).toBe("archived");
      });
    });

    describe("Scenario CRUD & Referential Integrity", () => {
      it("creates, reads, updates, and duplicates a test scenario", async () => {
        const { persona } = await createPersona(
          {
            projectId,
            name: "Scenario Target Persona",
            category: "customer_experience",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        const scenarioConfig = emptyScenarioConfig();
        scenarioConfig.objective.primaryGoal = "Negotiate discounted renewal";
        scenarioConfig.evaluation.successCriteria = ["Discount tier quoted"];
        scenarioConfig.evaluation.failureConditions = ["Refused to talk discounts"];

        const { scenario, readiness } = await createScenario(
          {
            projectId,
            personaId: persona.id,
            name: "Annual Contract Renewal",
            description: "Attempts to leverage churn threat for discount",
            priority: "high",
            config: scenarioConfig,
          },
          ctx(),
        );

        expect(scenario.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(scenario.personaId).toBe(persona.id);
        expect(scenario.priority).toBe("high");
        expect(readiness.isReady).toBe(true);

        // Check scenario count on persona
        const personaRead = await getPersona(persona.id, ctx());
        expect(personaRead.scenarioCount).toBe(1);

        // Read scenario
        const read = await getScenario(scenario.id, ctx());
        expect(read.scenario.name).toBe("Annual Contract Renewal");
        expect(read.persona?.name).toBe("Scenario Target Persona");

        // Update scenario
        const updated = await updateScenario(
          scenario.id,
          {
            name: "Updated Renewal Scenario",
            priority: "critical",
          },
          ctx(),
        );
        expect(updated.scenario.name).toBe("Updated Renewal Scenario");
        expect(updated.scenario.priority).toBe("critical");

        // Duplicate scenario
        const copy = await duplicateScenario(scenario.id, ctx());
        expect(copy.scenario.id).not.toBe(scenario.id);
        expect(copy.scenario.name).toBe("Updated Renewal Scenario (Copy)");

        // Archive scenario
        const archived = await archiveScenario(scenario.id, ctx());
        expect(archived.status).toBe("archived");
      });

      it("prevents deleting a persona that has linked scenarios (referential integrity check)", async () => {
        const { persona } = await createPersona(
          {
            projectId,
            name: "Protected Persona",
            category: "support",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        const { scenario } = await createScenario(
          {
            projectId,
            personaId: persona.id,
            name: "Linked Test Scenario",
            config: emptyScenarioConfig(),
          },
          ctx(),
        );

        // Attempting to delete persona should fail with ConflictError
        await expect(deletePersona(persona.id, ctx())).rejects.toThrow(ConflictError);

        // Now delete the scenario first
        await deleteScenario(scenario.id, ctx());

        // Now persona deletion succeeds
        const deleted = await deletePersona(persona.id, ctx());
        expect(deleted.deleted).toBe(true);

        // Confirm persona is gone
        await expect(getPersona(persona.id, ctx())).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("Search, Filter, and Statistics", () => {
      it("filters personas by category, status, and search query", async () => {
        const uniqueTag = `tag-${Date.now()}`;
        await createPersona(
          {
            projectId,
            name: `Unique Alpha ${uniqueTag}`,
            category: "pricing_policies",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        await createPersona(
          {
            projectId,
            name: `Unique Beta ${uniqueTag}`,
            category: "communication",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        // Search by query
        const searchRes = await listPersonas({ projectId, search: uniqueTag }, ctx());
        expect(searchRes).toHaveLength(2);

        // Filter by category
        const pricingRes = await listPersonas(
          { projectId, search: uniqueTag, category: "pricing_policies" },
          ctx(),
        );
        expect(pricingRes).toHaveLength(1);
        expect(pricingRes[0]?.name).toContain("Alpha");
      });

      it("computes accurate aggregate persona stats for a project", async () => {
        const stats = await getPersonaStats(projectId, ctx());
        expect(stats.total).toBeGreaterThan(0);
        expect(stats.ready + stats.draft + stats.needsConfig).toBe(stats.total);
      });

      it("enforces tenant isolation: another owner cannot access personas or scenarios", async () => {
        const otherOwner = "intruder-owner-uuid-9";
        const { persona } = await createPersona(
          {
            projectId,
            name: "Secret Customer",
            config: emptyPersonaConfig(),
          },
          ctx(),
        );

        // Other owner cannot read the persona
        await expect(getPersona(persona.id, ctx(otherOwner))).rejects.toBeInstanceOf(NotFoundError);

        // Other owner cannot list it
        const listOther = await listPersonas({ projectId }, ctx(otherOwner));
        expect(listOther.find((p) => p.id === persona.id)).toBeUndefined();
      });
    });
  });
}

