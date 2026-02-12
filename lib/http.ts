import { NextResponse } from "next/server";

type ErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR" | "CONFIG_ERROR";

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

export const noContent = () => new NextResponse(null, { status: 204 });

export const errorResponse = (
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
) =>
  NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? null
      }
    },
    { status }
  );

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "unknown";
};

export const isSchemaCacheError = (error: unknown) => {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = getErrorMessage(error).toLowerCase();
  return code === "PGRST205" || message.includes("schema cache");
};
