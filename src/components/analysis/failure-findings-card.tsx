"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  Quote,
  Sparkles,
} from "lucide-react";
import type { FailureFindingRecord } from "@/server/analysis/schema";
import { CATEGORY_DEFINITIONS } from "@/server/analysis/categories";

export interface FailureFindingsCardProps {
  findings: FailureFindingRecord[];
  isAnalyzing?: boolean;
  onAnalyze?: () => void;
  onFixWithAI?: (finding: FailureFindingRecord) => void;
  isFixingId?: string | null;
}

export function FailureFindingsCard({
  findings,
  isAnalyzing,
  onAnalyze,
  onFixWithAI,
  isFixingId,
}: FailureFindingsCardProps) {
  const [expandedEvidence, setExpandedEvidence] = React.useState<Record<string, boolean>>({});

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (findings.length === 0) {
    return (
      <Card className="border-dashed p-4 text-center">
        <p className="text-xs text-muted">No failure findings recorded for this run.</p>
        {onAnalyze && (
          <Button
            size="sm"
            variant="secondary"
            loading={isAnalyzing}
            onClick={onAnalyze}
            className="mt-3 text-xs"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-accent" />
            Analyze Failure with AI
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((f) => {
        const catInfo = CATEGORY_DEFINITIONS[f.category] || {
          label: f.category,
          description: "",
        };
        const hasEvidence = f.evidenceReferences && f.evidenceReferences.length > 0;
        const isExpanded = Boolean(expandedEvidence[f.id]);
        const isFixing = isFixingId === f.id;

        return (
          <Card key={f.id} className="border-l-4 border-l-danger p-4 space-y-3 text-xs">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      f.severity === "critical"
                        ? "danger"
                        : f.severity === "major"
                        ? "warning"
                        : "neutral"
                    }
                    className="uppercase text-[10px]"
                  >
                    {f.severity}
                  </Badge>
                  <span className="font-semibold text-sm text-foreground">{f.title}</span>
                  <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-muted">
                    {catInfo.label}
                  </span>
                </div>
                <p className="text-muted leading-relaxed">{f.description}</p>
              </div>

              {/* Confidence Pill */}
              <div className="flex items-center gap-1.5">
                {f.confidence === "proven" ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Proven Evidence
                  </span>
                ) : f.confidence === "hypothesis" ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Likely Hypothesis
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                    <HelpCircle className="h-3 w-3" />
                    Inconclusive
                  </span>
                )}
              </div>
            </div>

            {/* Expected vs Observed Discrepancy Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md bg-subtle/50 p-3">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Expected Behavior:
                </span>
                <p className="mt-0.5 text-foreground">{f.expectedBehavior}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Observed Behavior:
                </span>
                <p className="mt-0.5 text-danger">{f.observedBehavior}</p>
              </div>
              <div className="md:col-span-2 pt-1 border-t border-border/50">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Why It Failed:
                </span>
                <p className="mt-0.5 text-muted">{f.discrepancyExplanation}</p>
              </div>
            </div>

            {/* Evidence References Accordion */}
            {hasEvidence && (
              <div className="space-y-1.5 border-t pt-2">
                <button
                  type="button"
                  onClick={() => toggleEvidence(f.id)}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span>
                    {isExpanded ? "Hide" : "Show"} Transcript Evidence (
                    {f.evidenceReferences.length} citation
                    {f.evidenceReferences.length > 1 ? "s" : ""})
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-1.5 pl-3 border-l-2 border-accent/40 mt-1.5">
                    {f.evidenceReferences.map((e, idx) => (
                      <div key={idx} className="bg-background rounded p-2 text-xs">
                        <div className="flex items-center gap-2 text-[10px] text-muted">
                          <Quote className="h-2.5 w-2.5 text-accent" />
                          <span className="uppercase font-semibold">
                            {e.role || "turn"}
                            {e.messageIndex != null ? ` (Turn ${e.messageIndex + 1})` : ""}
                          </span>
                          {e.timeInCallSecs != null && <span>at {e.timeInCallSecs}s</span>}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-foreground italic">
                          &ldquo;{e.excerpt}&rdquo;
                        </p>
                        {e.note && <p className="mt-1 text-[10px] text-muted">{e.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggested Action & Fix with AI Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex items-start gap-1.5 max-w-xl">
                <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span className="text-muted text-[11px]">
                  <strong className="text-foreground">Recommendation:</strong> {f.suggestedAction}
                </span>
              </div>

              {f.isActionable && onFixWithAI && (
                <Button
                  size="sm"
                  variant="primary"
                  loading={isFixing}
                  onClick={() => onFixWithAI(f)}
                  className="text-xs"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Fix with AI
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
