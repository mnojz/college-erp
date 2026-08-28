import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { type SyllabusMeta } from "@/app/lib/syllabi-shared";

/**
 * GET /api/syllabi/meta — public filter options:
 * distinct departments and all programs (with their departments).
 */
export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      orderBy: [{ departmentName: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        departmentName: true,
      },
    });
    const departments = [
      ...new Set(programs.map((p) => p.departmentName)),
    ].sort((a, b) => a.localeCompare(b));

    const meta: SyllabusMeta = { departments, programs };
    return NextResponse.json(meta);
  } catch (error) {
    console.error("GET /api/syllabi/meta error:", error);
    return NextResponse.json(
      { error: "Unable to load filter options" },
      { status: 500 },
    );
  }
}
