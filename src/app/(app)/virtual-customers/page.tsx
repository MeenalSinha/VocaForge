import type { Metadata } from "next";
import { FutureFeature } from "@/components/layout/future-feature";

export const metadata: Metadata = { title: "Virtual Customers" };

export default function VirtualCustomersPage() {
  return (
    <FutureFeature
      title="Virtual Customers"
      phase={3}
      purpose="Define realistic customers: impatient, confused, multilingual, or unfamiliar with your product."
      dependsOn="Needs persona storage, which is added after projects and agents."
      capabilities={[
        "Create personas from templates or from scratch",
        "Edit goals, tone, language and behaviour per persona",
        "Attach personas to a project",
      ]}
    />
  );
}
