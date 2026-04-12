import { z, type ZodError } from "zod";

export function formatValidationError(error: ZodError): string {
  const [issue] = error.issues;

  if (!issue) {
    return "Invalid request payload";
  }

  if (issue.path.length === 0) {
    return issue.message;
  }

  return `${issue.path.join(".")}: ${issue.message}`;
}

export function requiredText(field: string) {
  return z.string().transform((value) => value.trim()).refine((value) => value.length > 0, {
    message: `${field} is required`,
  });
}

export function optionalText() {
  return z.string().transform((value) => value.trim()).optional();
}

export function positiveNumber(field: string) {
  return z.number().finite().refine((value) => value > 0, {
    message: `${field} must be greater than 0`,
  });
}

export function nonNegativeNumber(field: string) {
  return z.number().finite().refine((value) => value >= 0, {
    message: `${field} must be greater than or equal to 0`,
  });
}

export function positiveInteger(field: string) {
  return z.number().int().refine((value) => value > 0, {
    message: `${field} must be a positive integer`,
  });
}

export function nonNegativeInteger(field: string) {
  return z.number().int().refine((value) => value >= 0, {
    message: `${field} must be a non-negative integer`,
  });
}

export function normalizedEnum<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
  field: string,
) {
  return z.string().transform((value) => value.trim().toUpperCase()).refine(
    (value): value is TValues[number] => values.includes(value),
    {
      message: `${field} must be one of: ${values.join(", ")}`,
    },
  );
}

export function optionalNormalizedEnum<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
  field: string,
) {
  return normalizedEnum(values, field).optional();
}
