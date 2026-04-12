import {
  CreateSalesOrderBody,
  SALES_ORDER_STATUSES,
  UpdateSalesOrderBody,
} from "@workspace/api-zod";
import { z } from "zod";
import {
  nonNegativeNumber,
  optionalNormalizedEnum,
  optionalText,
  positiveInteger,
} from "../../lib/request-validation";

const positiveIntegerArray = z.array(positiveInteger("rollIds item")).min(1, {
  message: "rollIds must contain at least one item",
});

const createSalesOrderSchema = CreateSalesOrderBody.extend({
  customerId: positiveInteger("customerId"),
  rollIds: positiveIntegerArray,
  totalAmount: nonNegativeNumber("totalAmount"),
  notes: optionalText(),
});

const updateSalesOrderSchema = UpdateSalesOrderBody.extend({
  status: optionalNormalizedEnum(SALES_ORDER_STATUSES, "status"),
  totalAmount: nonNegativeNumber("totalAmount").optional(),
  notes: optionalText(),
  invoiceNumber: optionalText(),
});

export const parseCreateSalesOrderBody = (input: unknown) => createSalesOrderSchema.safeParse(input);
export const parseUpdateSalesOrderBody = (input: unknown) => updateSalesOrderSchema.safeParse(input);
