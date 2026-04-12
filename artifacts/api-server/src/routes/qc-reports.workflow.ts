import type { fabricRollsTable } from "@workspace/db";
import {
  FABRIC_ROLL_WORKFLOW_STATUS,
  getFabricRollStatusFromQcResult,
} from "@workspace/api-zod";

type FabricRollRow = typeof fabricRollsTable.$inferSelect;

export class QcWorkflowError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "QcWorkflowError";
    this.status = status;
  }
}

export function assertRollCanReceiveQc(roll: Pick<FabricRollRow, "status">): void {
  const allowedStatuses = [
    FABRIC_ROLL_WORKFLOW_STATUS.qcPending,
    FABRIC_ROLL_WORKFLOW_STATUS.qcFailed,
    FABRIC_ROLL_WORKFLOW_STATUS.qcPassed,
  ];

  if (!allowedStatuses.includes(roll.status as (typeof allowedStatuses)[number])) {
    throw new QcWorkflowError("Fabric roll must be in a QC state before recording a QC decision");
  }
}

function normalizeQcResultInput(result: string) {
  const normalized = result.trim().toUpperCase();
  if (normalized === "PASSED") return "PASS";
  if (normalized === "FAILED") return "FAIL";
  if (normalized === "SECOND") return "REWORK";
  return normalized;
}

export function buildQcDecision(result: string) {
  const normalizedResult = normalizeQcResultInput(result);
  const rollStatus = getFabricRollStatusFromQcResult(normalizedResult);

  if (normalizedResult === "PASS") {
    return {
      result: normalizedResult,
      rollStatus,
      downstreamEligible: true,
      nextStep: {
        action: "Send to dyeing",
        description: "The roll passed QC and is eligible for dyeing.",
        route: "/dyeing",
      },
    };
  }

  if (normalizedResult === "FAIL") {
    return {
      result: normalizedResult,
      rollStatus,
      downstreamEligible: false,
      nextStep: {
        action: "Review failed QC",
        description: "The roll failed QC and is blocked from dyeing, warehouse, and sales until reworked.",
        route: "/quality-control",
      },
    };
  }

  if (normalizedResult === "REWORK") {
    return {
      result: normalizedResult,
      rollStatus,
      downstreamEligible: false,
      nextStep: {
        action: "Rework roll",
        description: "The roll needs rework before another QC decision can make it downstream-eligible.",
        route: "/quality-control",
      },
    };
  }

  return {
    result: "PENDING" as const,
    rollStatus,
    downstreamEligible: false,
    nextStep: {
      action: "Complete QC decision",
      description: "QC is still pending, so downstream movement is blocked.",
      route: "/quality-control",
    },
  };
}
