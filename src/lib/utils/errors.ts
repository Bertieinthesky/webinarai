/**
 * errors.ts — API error handling utilities
 *
 * PURPOSE:
 *   Provides consistent error response formatting across all API routes.
 *   Includes a custom AppError class for typed errors with status codes,
 *   and helper functions for building JSON error responses.
 *
 * USAGE:
 *   - throw new AppError("Not found", 404) in API routes
 *   - return errorResponse("Bad request", 400) for quick inline errors
 *   - Wrap route handlers with try/catch → handleApiError(error)
 *
 * ARCHITECTURE:
 *   - Used by: All /api/ route handlers
 *   - AppError: Custom error class with statusCode and optional code
 *   - handleApiError: Catches AppError (returns typed response) or
 *     unknown errors (logs + returns 500)
 */

import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode);
  }
  console.error("Unhandled API error:", error);
  return errorResponse("Internal server error", 500);
}
