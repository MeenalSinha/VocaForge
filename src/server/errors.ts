/** Application errors with stable codes. Safe to serialise to clients. */
export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request is invalid.", fieldErrors?: FieldErrors) {
    super("validation_error", 422, message, fieldErrors);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super("not_found", 404, message);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super("conflict", 409, message, fieldErrors);
  }
}
export class ConfigError extends AppError {
  constructor(message: string) {
    super("config_error", 503, message);
  }
}
export class DatabaseUnavailableError extends AppError {
  constructor(message = "The database is unavailable. Check DATABASE_URL and that PostgreSQL is running.") {
    super("database_unavailable", 503, message);
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
