import { z, ZodSchema } from "zod";
import { NextResponse } from "next/server";

/** Common limits for API input validation */
export const LIMITS = {
  stringShort: 500,
  stringMedium: 2000,
  stringLong: 50_000,
  arrayMax: 100,
} as const;

/**
 * Parse and validate request body with Zod. Use at the start of POST/PUT API routes.
 * @param request - Next.js request
 * @param schema - Zod schema
 * @returns [parsed data, null] or [null, 400 NextResponse]
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<[T, null] | [null, NextResponse]> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return [null, NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })];
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const message = Object.entries(first)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
      .join("; ") || "Validation failed";
    return [null, NextResponse.json({ error: message }, { status: 400 })];
  }
  return [result.data, null];
}

/**
 * Validate query/search params with Zod.
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  schema: ZodSchema<T>
): [T, null] | [null, NextResponse] {
  const raw: Record<string, string> = {};
  const params = searchParams instanceof URLSearchParams
    ? Object.fromEntries(searchParams.entries())
    : searchParams;
  for (const [k, v] of Object.entries(params)) {
    raw[k] = Array.isArray(v) ? v[0] ?? "" : (v ?? "");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const message = Object.entries(first)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
      .join("; ") || "Invalid parameters";
    return [null, NextResponse.json({ error: message }, { status: 400 })];
  }
  return [result.data, null];
}

/** Reusable Zod refinements: no control characters, safe for display */
export const safeString = (max: number = LIMITS.stringShort) =>
  z.string().max(max).refine((s) => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(s), "Invalid characters");
