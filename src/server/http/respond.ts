import { NextResponse } from "next/server";
import { AppError, isAppError } from "../errors";
import { logger, serializeError } from "../logger";

/** Uniform JSON envelope: { data } on success, { error: { code, message, fieldErrors? } } on failure. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function toErrorResponse(err: unknown) {
  if (isAppError(err)) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } },
      { status: err.status },
    );
  }
  // Unknown errors: keep details in server logs, return a sanitized message.
  logger.error("unhandled route error", { err: serializeError(err) });
  const body: { error: { code: string; message: string } } = {
    error: { code: "internal_error", message: "Something went wrong on the server. Check the server logs." },
  };
  return NextResponse.json(body, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("invalid_json", 400, "The request body must be valid JSON.");
  }
}

export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
