import type { Metadata } from "next";
import { FutureFeature } from "@/components/layout/future-feature";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return (
    <FutureFeature
      title="Results"
      phase={5}
      purpose="Read transcripts, verdicts and evidence for every test run."
      dependsOn="Needs recorded test runs. Nothing is shown here until real runs exist."
      capabilities={[
        "Transcripts with the criteria that passed or failed",
        "Failure categories across runs",
        "Metrics calculated from recorded executions",
      ]}
    />
  );
}
