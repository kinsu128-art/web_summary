import { NextResponse } from "next/server";

type ErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";

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
