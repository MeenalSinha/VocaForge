"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The raw error is intentionally not rendered. Details are in the server logs (see digest).
  return (
    <ErrorState message="This page failed to load. The details were recorded in the server logs.">
      <Button variant="secondary" onClick={reset}>Try again</Button>
    </ErrorState>
  );
}
