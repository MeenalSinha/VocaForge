import type { Metadata } from "next";
import { FutureFeature } from "@/components/layout/future-feature";

export const metadata: Metadata = { title: "Deployments" };

export default function DeploymentsPage() {
  return (
    <FutureFeature
      title="Deployments"
      phase={7}
      purpose="Promote a verified agent version and watch how it behaves."
      dependsOn="Needs verified agent versions and passing regression runs."
      capabilities={[
        "Deploy a chosen agent version",
        "Roll back to an earlier version",
        "Observe deployed agent behaviour",
      ]}
    />
  );
}
