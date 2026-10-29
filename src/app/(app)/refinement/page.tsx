import type { Metadata } from "next";
import { FutureFeature } from "@/components/layout/future-feature";

export const metadata: Metadata = { title: "Refinement" };

export default function RefinementPage() {
  return (
    <FutureFeature
      title="Refinement"
      phase={6}
      purpose="Turn failed tests into proposed fixes, then rerun to confirm they worked."
      dependsOn="Needs recorded findings from Results."
      capabilities={[
        "Proposed prompt and configuration changes for review",
        "Regression reruns against earlier failures",
        "Before and after comparison",
      ]}
    />
  );
}
