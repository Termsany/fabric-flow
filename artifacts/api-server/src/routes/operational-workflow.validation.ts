import {
  CreateProductionOrderBody,
  CreateQcReportBody,
  FABRIC_ROLL_STATUSES,
  PRODUCTION_ORDER_STATUSES,
  UpdateFabricRollBody,
  UpdateProductionOrderBody,
  UpdateQcReportBody,
} from "@workspace/api-zod";
import { z } from "zod";
import {
  nonNegativeInteger,
  normalizedEnum,
  optionalNormalizedEnum,
  optionalText,
  positiveInteger,
  positiveNumber,
  requiredText,
} from "../lib/request-validation";

const trimmedStringArray = z.array(
  z.string().transform((value) => value.trim()).refine((value) => value.length > 0, {
    message: "images entries must not be empty",
  }),
);

const QC_DECISION_RESULTS = ["PASS", "FAIL", "PENDING", "REWORK"] as const;
const acceptedQcResults = [...QC_DECISION_RESULTS, "SECOND", "PASSED", "FAILED"] as const;

function normalizeQcResultInput(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "PASSED") return "PASS";
  if (normalized === "FAILED") return "FAIL";
  if (normalized === "SECOND") return "REWORK";
  return normalized;
}

const qcResultInput = z.string().transform((value) => normalizeQcResultInput(value)).refine(
  (value): value is (typeof QC_DECISION_RESULTS)[number] => (QC_DECISION_RESULTS as readonly string[]).includes(value),
  {
    message: `result must be one of: ${acceptedQcResults.join(", ")}`,
  },
);

const createProductionOrderSchema = CreateProductionOrderBody.extend({
  fabricType: requiredText("fabricType"),
  gsm: positiveNumber("gsm"),
  width: positiveNumber("width"),
  rawColor: requiredText("rawColor"),
  quantity: positiveInteger("quantity"),
  notes: optionalText(),
});

const updateProductionOrderSchema = UpdateProductionOrderBody.extend({
  status: optionalNormalizedEnum(PRODUCTION_ORDER_STATUSES, "status"),
  notes: optionalText(),
});

const updateFabricRollSchema = UpdateFabricRollBody.extend({
  status: optionalNormalizedEnum(FABRIC_ROLL_STATUSES, "status"),
  warehouseId: positiveInteger("warehouseId").optional(),
  color: optionalText(),
  length: positiveNumber("length").optional(),
  weight: positiveNumber("weight").optional(),
  notes: optionalText(),
});

const createQcReportSchema = CreateQcReportBody.extend({
  fabricRollId: positiveInteger("fabricRollId"),
  result: qcResultInput,
  defects: optionalText(),
  defectCount: nonNegativeInteger("defectCount"),
  images: trimmedStringArray.optional(),
  notes: optionalText(),
});

const updateQcReportSchema = UpdateQcReportBody.extend({
  result: qcResultInput.optional(),
  defects: optionalText(),
  defectCount: nonNegativeInteger("defectCount").optional(),
  notes: optionalText(),
});

export const parseCreateProductionOrderBody = (input: unknown) => createProductionOrderSchema.safeParse(input);
export const parseUpdateProductionOrderBody = (input: unknown) => updateProductionOrderSchema.safeParse(input);
export const parseUpdateFabricRollBody = (input: unknown) => updateFabricRollSchema.safeParse(input);
export const parseCreateQcReportBody = (input: unknown) => createQcReportSchema.safeParse(input);
export const parseUpdateQcReportBody = (input: unknown) => updateQcReportSchema.safeParse(input);
