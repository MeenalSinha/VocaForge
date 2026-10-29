# Phase 6: Safe Rollback & Operational Recovery

## 1. Principles of Non-Destructive Rollback
In mission-critical conversational AI, restoring an earlier baseline must never compromise audit trails or destroy subsequent revisions.

VocaForge follows an append-only, non-destructive rollback policy:
1. **Never Overwrite or Truncate History**: Earlier versions (`v1`, `v2`, etc.) remain permanently intact.
2. **Immutable Append**: Restoring `v1` from `v2` creates a new version record (`v3`) whose source is explicitly tagged as `rollback`.
3. **Mandatory Reason & Audit Logging**: Every rollback requires or defaults to an explanatory note explaining why the restoration occurred.
4. **Immediate Remote Synchronization**: The restored configuration payload is immediately pushed to ElevenLabs to re-align caller execution with the restored baseline.
5. **Deployment State Transition**: A new deployment record is registered with status `rolled_back`, preserving the operational history in `agent_deployments`.

---

## 2. Recovery Workflow
1. User identifies an in-production degradation via the **Results & Observability** workspace.
2. In **Deployments**, the user clicks **Rollback to Previous Version**.
3. The **RollbackModal** displays only eligible earlier configurations strictly before the active version.
4. User selects the target baseline and provides an operational incident note (e.g. *"Prompt regression on refund instructions"*).
5. The rollback engine:
   - Validates the target configuration schema.
   - Appends a new immutable version record with `source: 'rollback'`.
   - Pushes configuration to ElevenLabs via `ElevenLabsClient.updateAgent()`.
   - Records activity event `agent.rollback` and `deployment.rolled_back`.
   - Automatically archives any broken active deployments.
