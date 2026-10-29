import type { Metadata } from "next";
import { FutureFeature } from "@/components/layout/future-feature";

export const metadata: Metadata = { title: "Test Lab" };

export default function TestLabPage() {
  return (
    <FutureFeature
      title="Test Lab"
      phase={4}
      purpose="Write scenarios with success criteria and run virtual customers against an agent."
      dependsOn="Needs agents and personas, and builds on the ElevenLabs simulation workflow validated in Phase 0."
      capabilities={[
        "Edit scenarios and success criteria",
        "Run simulations against a configured agent",
        "Follow execution status as it happens",
      ]}
    />
  );
}
