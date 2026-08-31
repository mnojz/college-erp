import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

/**
 * Safely parse a JSON request body against a Zod schema.
 *
 * Returns `{ ok: true, value }` on success, or `{ ok: false, response }` with
 * a 400 JSON error (including Zod issues for the client) on failure.
 *
 * Usage:
 *   const parsed = await jsonBody(request, AssessmentBodySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.value;
 */
export async function jsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 },
      ),
    };
  }

    return { ok: true, value: result.data };
}