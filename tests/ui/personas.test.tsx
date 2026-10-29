// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonaCard } from "@/components/personas/persona-card";
import { ScenarioCard } from "@/components/personas/scenario-card";
import { TemplateLibrary } from "@/components/personas/template-library";
import { PersonaPreviewModal } from "@/components/personas/persona-preview-modal";
import VirtualCustomersPage from "@/app/(app)/virtual-customers/page";
import { emptyPersonaConfig, emptyScenarioConfig, type PersonaRecord, type ScenarioRecord } from "@/server/personas/schema";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/virtual-customers" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const samplePersona: PersonaRecord = {
  id: "persona-1234",
  projectId: "proj-1234",
  ownerId: "owner-1",
  name: "Marcus Vance",
  description: "Busy CFO requiring quick answers",
  category: "customer_experience",
  templateId: "impatient-customer",
  status: "ready_for_testing",
  version: 1,
  config: {
    ...emptyPersonaConfig(),
    personality: {
      ...emptyPersonaConfig().personality,
      traits: ["direct", "impatient"],
      patienceLevel: 2,
    },
    defaultObjective: {
      intent: "Confirm invoice details immediately",
      mustAchieve: ["Invoice date", "Total amount"],
    },
  },
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
};

const sampleScenario: ScenarioRecord = {
  id: "scenario-5678",
  projectId: "proj-1234",
  ownerId: "owner-1",
  personaId: "persona-1234",
  targetAgentId: null,
  name: "Billing Clarification Call",
  description: "Test how agent handles aggressive questions",
  status: "ready_for_testing",
  priority: "high",
  config: {
    ...emptyScenarioConfig(),
    objective: {
      primaryGoal: "Dispute unexpected service fee",
      expectedOutcome: "Fee explanation or fee waiver",
      requiredInformation: ["Account number"],
      deliberatelyWithheld: [],
    },
    evaluation: {
      successCriteria: ["Fee explained clearly"],
      failureConditions: ["Agent hangs up"],
      prohibitedOutcomes: [],
    },
  },
  createdAt: "2026-10-29T12:00:00Z",
  updatedAt: "2026-10-29T12:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PersonaCard", () => {
  it("renders persona name, badges, description, and scenario count", () => {
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onArchive = vi.fn();
    const onCreateScenario = vi.fn();

    render(
      <PersonaCard
        persona={samplePersona}
        scenarioCount={3}
        onPreview={onPreview}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        onCreateScenario={onCreateScenario}
      />,
    );

    expect(screen.getByText("Marcus Vance")).toBeInTheDocument();
    expect(screen.getByText("Busy CFO requiring quick answers")).toBeInTheDocument();
    expect(screen.getByText("Customer Experience")).toBeInTheDocument();
    expect(screen.getByText("Ready for Testing")).toBeInTheDocument();
    expect(screen.getByText(/3 scenario\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText("direct")).toBeInTheDocument();
    expect(screen.getByText("impatient")).toBeInTheDocument();
  });

  it("handles preview and action clicks correctly", async () => {
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <PersonaCard
        persona={samplePersona}
        scenarioCount={0}
        onPreview={onPreview}
        onEdit={onEdit}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onCreateScenario={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("Inspect configuration"));
    expect(onPreview).toHaveBeenCalledWith(samplePersona);

    await user.click(screen.getByRole("button", { name: /Edit/i }));
    expect(onEdit).toHaveBeenCalledWith(samplePersona);
  });
});

describe("ScenarioCard", () => {
  it("renders scenario information, priority, and objective", () => {
    const onEdit = vi.fn();
    render(
      <ScenarioCard
        scenario={sampleScenario}
        persona={samplePersona}
        onEdit={onEdit}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    expect(screen.getByText("Billing Clarification Call")).toBeInTheDocument();
    expect(screen.getByText("Marcus Vance")).toBeInTheDocument();
    expect(screen.getByText("High Priority")).toBeInTheDocument();
    expect(screen.getByText("Test how agent handles aggressive questions")).toBeInTheDocument();
    expect(screen.getByText(/Success Criteria \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Fee explained clearly")).toBeInTheDocument();
    expect(screen.getByText(/1 failure condition\(s\)/)).toBeInTheDocument();
  });
});

describe("TemplateLibrary", () => {
  it("renders starter templates and allows filtering", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<TemplateLibrary onSelectTemplate={onSelect} />);

    expect(screen.getByText("Persona Template Library")).toBeInTheDocument();
    expect(screen.getByText("Impatient Customer")).toBeInTheDocument();

    // Filter by search
    const searchInput = screen.getByPlaceholderText(/Search templates/i);
    await user.type(searchInput, "confused");

    expect(screen.getByText("Confused First-Time Customer")).toBeInTheDocument();
    expect(screen.queryByText("Impatient Customer")).not.toBeInTheDocument();
  });

  it("triggers onSelectTemplate when Use Template is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<TemplateLibrary onSelectTemplate={onSelect} />);

    const useButtons = screen.getAllByRole("button", { name: /Use This Template/i });
    expect(useButtons.length).toBeGreaterThan(0);
    await user.click(useButtons[0]!);

    expect(onSelect).toHaveBeenCalled();
  });
});

describe("PersonaPreviewModal", () => {
  it("renders complete customer details inside dialog", () => {
    render(
      <PersonaPreviewModal
        persona={samplePersona}
        open={true}
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        onCreateScenario={vi.fn()}
        scenarioCount={2}
      />,
    );

    expect(screen.getByText("Marcus Vance")).toBeInTheDocument();
    expect(screen.getByText("Confirm invoice details immediately")).toBeInTheDocument();
    expect(screen.getByText(/2 associated scenario/i)).toBeInTheDocument();
  });
});

describe("VirtualCustomersPage Integration", () => {
  it("fetches and renders project data and switches tabs", async () => {
    const stub = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u === "/api/projects") {
        return new Response(JSON.stringify({ data: [{ id: "proj-1234", name: "Main Project" }] }));
      }
      if (u.startsWith("/api/personas?")) {
        return new Response(JSON.stringify({ data: [samplePersona] }));
      }
      if (u.startsWith("/api/scenarios?")) {
        return new Response(JSON.stringify({ data: [sampleScenario] }));
      }
      if (u.startsWith("/api/agents?")) {
        return new Response(JSON.stringify({ data: [] }));
      }
      if (u.startsWith("/api/personas/stats?")) {
        return new Response(
          JSON.stringify({
            data: { total: 1, ready: 1, draft: 0, needsConfig: 0, archived: 0 },
          }),
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", stub);

    const user = userEvent.setup();
    render(<VirtualCustomersPage />);

    // Wait for initial data load
    expect(await screen.findByText("Marcus Vance")).toBeInTheDocument();
    expect(screen.getByText("Virtual Customer Studio")).toBeInTheDocument();

    // Stats
    expect(screen.getByText("Total Customers")).toBeInTheDocument();

    // Switch to Scenarios Tab
    const scenarioTab = screen.getByRole("button", { name: /Test Scenarios/i });
    await user.click(scenarioTab);

    expect(await screen.findByText("Billing Clarification Call")).toBeInTheDocument();

    // Switch to Templates Tab
    const templateTab = screen.getByRole("button", { name: /Template Library/i });
    await user.click(templateTab);

    expect(await screen.findByText("Persona Template Library")).toBeInTheDocument();
  });
});
