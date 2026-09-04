import { prisma } from "@/app/lib/prisma";

/**
 * Get the single department ID (used by other APIs to auto-assign).
 * Returns null if no department has been set up yet.
 *
 * Lives in a lib module (not the route file) so route modules only
 * export HTTP handlers.
 */
export async function getDepartmentId(): Promise<string | null> {
  const dept = await prisma.department.findFirst({ select: { id: true } });
  return dept?.id ?? null;
}