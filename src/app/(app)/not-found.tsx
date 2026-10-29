import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <EmptyState title="Page not found" description="The page or record you asked for does not exist, or it was removed.">
      <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
    </EmptyState>
  );
}
