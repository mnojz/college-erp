import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { parseSyllabusForm, serializeSyllabus } from "@/app/lib/syllabi-server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/syllabus/[id] — admin detail view for a syllabus.
 */
export async function GET(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const row = await prisma.syllabus.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        departmentName: true,
        programId: true,
        semester: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        program: { select: { id: true, name: true, code: true, departmentName: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });

    return NextResponse.json({ syllabus: serializeSyllabus(row) });
  } catch (error) {
    console.error("GET /api/syllabus/[id] error:", error);
    return NextResponse.json({ error: "Unable to load syllabus" }, { status: 500 });
  }
}

/**
 * PATCH /api/syllabus/[id] — edit metadata and/or replace the file (admin only).
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const existing = await prisma.syllabus.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });

    const parsed = await parseSyllabusForm(request);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;

    const bytes = data.file ? Buffer.from(await data.file.arrayBuffer()) : null;

    await prisma.syllabus.update({
      where: { id },
      data: {
        title: data.title,
        departmentName: data.departmentName,
        programId: data.programId,
        semester: data.semester,
        ...(bytes
          ? {
              fileName: data.file!.name,
              mimeType: data.file!.type || "application/pdf",
              fileSize: bytes.byteLength,
              fileData: bytes,
            }
          : {}),
      },
    });

    return NextResponse.json({ message: "Syllabus updated", syllabus: { id } });
  } catch (error) {
    console.error("PATCH /api/syllabus/[id] error:", error);
    return NextResponse.json({ error: "Unable to update syllabus" }, { status: 500 });
  }
}

/**
 * DELETE /api/syllabus/[id] — remove an uploaded syllabus (admin only).
 */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      select: { id: true, fileName: true },
    });
    if (!syllabus) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });
    }

    await prisma.syllabus.delete({ where: { id } });
    return NextResponse.json({ message: `Deleted "${syllabus.fileName}"` });
  } catch (error) {
    console.error("DELETE /api/syllabus/[id] error:", error);
    return NextResponse.json({ error: "Unable to delete syllabus" }, { status: 500 });
  }
}
