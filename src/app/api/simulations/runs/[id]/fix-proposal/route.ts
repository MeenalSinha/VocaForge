import { ok, readJson, route } from "@/server/http/respond";
import { createFixProposal } from "@/server/analysis/service";
import { ValidationError } from "@/server/errors";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, _ctx: { params: Promise<{ id: string }> }) => {
  const body = (await readJson(req)) as { findingId?: string };
  if (!body.findingId) {
    throw new ValidationError("Missing findingId in request body.", {
      findingId: ["Required to generate a targeted fix proposal."],
    });
  }
  const proposal = await createFixProposal(body.findingId);
  return ok(proposal, 201);
});

