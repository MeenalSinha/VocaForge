// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadinessCard } from "@/components/deployments/readiness-card";
import { RollbackModal } from "@/components/deployments/rollback-modal";
import { DeploymentDetailDrawer } from "@/components/deployments/deployment-detail-drawer";
import type { ReleaseReadinessSnapshot, DeploymentRecord } from "@/server/deployments/schema";
import { sampleConfig } from "../sample-config";

afterEach(cleanup);

describe("Deployments UI Components", () => {
  const readySnapshot: ReleaseReadinessSnapshot = {
    isReady: true,
    score: 100,
    testedRunsCount: 5,
    passedRunsCount: 5,
    passRatePercentage: 100,
    hasCriticalFindings: false,
    unresolvedFindingsCount: 0,
    isSyncedRemotely: true,
    checks: [
      {
        id: "config_valid",
        name: "Valid Agent Configuration",
        passed: true,
        message: "Agent configuration is structurally complete.",
        isBlocker: true,
      },
      {
        id: "pass_rate",
        name: "Evaluation Pass Rate Threshold (>= 80%)",
        passed: true,
        message: "Pass rate is 100% (5/5 passed).",
        isBlocker: true,
      },
    ],
    blockers: [],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
  };

  const blockedSnapshot: ReleaseReadinessSnapshot = {
    isReady: false,
    score: 50,
    testedRunsCount: 2,
    passedRunsCount: 1,
    passRatePercentage: 50,
    hasCriticalFindings: true,
    unresolvedFindingsCount: 1,
    isSyncedRemotely: false,
    checks: [
      {
        id: "pass_rate",
        name: "Evaluation Pass Rate Threshold (>= 80%)",
        passed: false,
        message: "Pass rate is 50% (1/2 passed).",
        isBlocker: true,
      },
    ],
    blockers: ["Evaluation pass rate is 50%, below the required 80% threshold."],
    warnings: ["1 scenario execution(s) did not pass evaluation."],
    evaluatedAt: new Date().toISOString(),
  };

  describe("ReadinessCard", () => {
    it("renders ready badge and enables deploy action when readiness passes", async () => {
      const onPromote = vi.fn();
      render(
        <ReadinessCard
          agentName="Support Concierge"
          agentVersion={2}
          readiness={readySnapshot}
          onPromote={onPromote}
        />,
      );

      expect(screen.getByRole("heading", { name: /Support Concierge/ })).toBeInTheDocument();
      expect(screen.getByText("Ready for Release")).toBeInTheDocument();
      expect(screen.getByText("Pass rate is 100% (5/5 passed).")).toBeInTheDocument();

      const promoteBtn = screen.getByRole("button", { name: /Promote to Production/i });
      expect(promoteBtn).not.toBeDisabled();
      await userEvent.click(promoteBtn);
      expect(onPromote).toHaveBeenCalledTimes(1);
    });

    it("renders release blocked badge and displays blockers when criteria fail", () => {
      const onPromote = vi.fn();
      render(
        <ReadinessCard
          agentName="Support Concierge"
          agentVersion={2}
          readiness={blockedSnapshot}
          onPromote={onPromote}
        />,
      );

      expect(screen.getByText("Release Blocked")).toBeInTheDocument();
      expect(
        screen.getByText(/below the required 80% threshold/),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Promote to Production/i })).toBeDisabled();
    });
  });

  describe("RollbackModal", () => {
    const versions = [
      {
        id: "v-1",
        version: 1,
        source: "created" as const,
        summary: "Initial verified configuration",
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
        syncError: null,
        createdAt: new Date().toISOString(),
        config: sampleConfig(),
      },
      {
        id: "v-2",
        version: 2,
        source: "manual_edit" as const,
        summary: "Prompt updates",
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
        syncError: null,
        createdAt: new Date().toISOString(),
        config: sampleConfig(),
      },
    ];

    it("renders eligible historical versions and triggers onRollback with chosen version and reason", async () => {
      const onRollback = vi.fn();
      render(
        <RollbackModal
          agentId="agent-123"
          agentName="Support Concierge"
          currentVersion={2}
          versions={versions}
          open={true}
          onOpenChange={vi.fn()}
          onRollback={onRollback}
        />,
      );

      expect(screen.getByText(/Rollback Configuration — Support Concierge/)).toBeInTheDocument();
      expect(screen.getAllByText(/Initial verified configuration/)[0]).toBeInTheDocument();

      const reasonInput = screen.getByPlaceholderText(/e\.g\. Degraded customer satisfaction/);
      await userEvent.type(reasonInput, "Prompt regression detected");

      const confirmBtn = screen.getByRole("button", { name: /Restore to Version 1/ });
      await userEvent.click(confirmBtn);

      expect(onRollback).toHaveBeenCalledWith(1, "Prompt regression detected");
    });
  });

  describe("DeploymentDetailDrawer", () => {
    const deployment: DeploymentRecord = {
      id: "dep-uuid-1",
      projectId: "proj-1",
      ownerId: null,
      agentId: "agent-1",
      agentName: "Support Concierge",
      agentVersion: 1,
      environment: "production",
      status: "deployed",
      remoteAgentId: "remote-agent-abc",
      readinessSnapshot: readySnapshot,
      notes: "Release note verification test",
      previousDeploymentId: null,
      deployedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("renders deployment metadata, environment, readiness score and release notes", () => {
      render(
        <DeploymentDetailDrawer
          deployment={deployment}
          open={true}
          onOpenChange={vi.fn()}
        />,
      );

      expect(screen.getByText(/Deployment Detail — Support Concierge/)).toBeInTheDocument();
      expect(screen.getByText("Release note verification test")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });
});
