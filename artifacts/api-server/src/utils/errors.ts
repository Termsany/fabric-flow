export class AppError extends Error {
  statusCode: number;

  details?: Record<string, string[]>;

  constructor(message: string, statusCode = 400, details?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function createValidationError(details: Record<string, string[]>) {
  return new AppError("Validation failed", 400, details);
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: error.details
        ? { message: error.message, errors: error.details }
        : { error: error.message },
    };
  }

  return {
    statusCode: 500,
    body: { error: "Internal server error" },
  };
}
