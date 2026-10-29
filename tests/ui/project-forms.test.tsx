// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectEditForm } from "@/components/projects/project-edit-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockClear(); refresh.mockClear(); });

describe("CreateProjectDialog", () => {
  it("validates on the client without calling the server", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<CreateProjectDialog defaultOpen />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required.");
    expect(f).not.toHaveBeenCalled();
  });

  it("posts to the API and navigates to the created project", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { id: "11111111-1111-4111-8111-111111111111" } }), { status: 201 }));
    vi.stubGlobal("fetch", f);
    const user = userEvent.setup();
    render(<CreateProjectDialog defaultOpen />);
    await user.type(screen.getByLabelText("Name"), "Front desk");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/11111111-1111-4111-8111-111111111111"));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/projects");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Front desk", description: "" });
  });

  it("shows server-side field errors such as a duplicate name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "conflict", message: "exists", fieldErrors: { name: ["A project with this name already exists."] } } }), { status: 409 })));
    const user = userEvent.setup();
    render(<CreateProjectDialog defaultOpen />);
    await user.type(screen.getByLabelText("Name"), "Dup");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("A project with this name already exists.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ProjectEditForm", () => {
  const project = { id: "p1", name: "Old", description: null, status: "active" as const, createdAt: "", updatedAt: "" };
  it("sends a PATCH with the edited values and refreshes the page data", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: project }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const user = userEvent.setup();
    render(<ProjectEditForm project={project} />);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "New name");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body)).name).toBe("New name");
  });
});
