// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { FutureFeature } from "@/components/layout/future-feature";
import { Sidebar } from "@/components/layout/sidebar";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { NAV_ITEMS } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects/abc", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(cleanup);

describe("application shell", () => {
  it("renders every primary navigation entry as a link and marks the current section", () => {
    render(<Sidebar />);
    for (const item of NAV_ITEMS) expect(screen.getByRole("link", { name: new RegExp(item.label) })).toHaveAttribute("href", item.href);
    expect(screen.getByRole("link", { name: /Projects/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Dashboard/ })).not.toHaveAttribute("aria-current");
  });

  it("labels future sections with their phase", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Test Lab/ })).toHaveTextContent("Phase 4");
    expect(screen.getByRole("link", { name: /Dashboard/ })).not.toHaveTextContent("Phase");
  });

  it("renders content, skip link and an accessible mobile menu that opens and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});

describe("future-phase sections", () => {
  it("states plainly that the feature is not implemented and offers no working controls", () => {
    render(<FutureFeature title="Test Lab" phase={4} purpose="Run tests." dependsOn="Needs agents." capabilities={["Run simulations"]} />);
    expect(screen.getByText("This section is not implemented yet.")).toBeInTheDocument();
    expect(screen.getByText("Planned for Phase 4")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Go to projects" })).toHaveAttribute("href", "/projects");
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });
});

describe("form primitives", () => {
  it("associates the label, hint and error with the control", () => {
    render(<Field id="n" label="Name" hint="Shown in lists" error="Name is required.">{(a) => <Input {...a} />}</Field>);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("n-hint n-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
  });
  it("renders an empty state with a call to action", () => {
    render(<EmptyState title="No projects yet" description="Create one."><button>Create</button></EmptyState>);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });
});
