import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  canViewerAccessMaterial,
  isUploaderOrAdmin,
  parseMaterialForm,
  serializeStudyMaterial,
} from "@/app/lib/materials-server";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/materials/[id] — detail view, access-checked. */
export async function GET(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await canViewerAccessMaterial(session, id))) {
    return NextResponse.json({ error: "Study material not found" }, { status: 404 });
  }

  try {
    const row = await prisma.studyMaterial.findUnique({
      where: { id },
      select: {
        id: true,
        uploaderId: true,
        title: true,
        description: true,
        topic: true,
        materialType: true,
        visibility: true,
        departmentName: true,
        programId: true,
        subjectId: true,
        semester: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
        program: { select: { id: true, name: true, code: true, departmentName: true } },
        subject: { select: { id: true, name: true, code: true } },
        uploader: { select: { id: true, firstName: true, lastName: true } },
        bookmarks: { where: { userId: session.userId }, select: { id: true } },
        _count: { select: { bookmarks: true, classLinks: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "Study material not found" }, { status: 404 });

    return NextResponse.json({
      material: serializeStudyMaterial(row),
      canEdit: await isUploaderOrAdmin(session, row),
    });
  } catch (error) {
    console.error("GET /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Unable to load study material" }, { status: 500 });
  }
}

/** PATCH /api/materials/[id] — edit metadata and/or replace the file (owner or admin). */
export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
      select: { id: true, uploaderId: true },
    });
    if (!material || !(await isUploaderOrAdmin(session, material))) {
      return NextResponse.json({ error: "Study material not found" }, { status: 404 });
    }

    const parsed = await parseMaterialForm(request);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;

    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId }, select: { id: true } });
      if (!subject) return NextResponse.json({ error: "Selected subject does not exist" }, { status: 400 });
    }
    if (data.programId) {
      const program = await prisma.program.findUnique({ where: { id: data.programId }, select: { id: true } });
      if (!program) return NextResponse.json({ error: "Selected program does not exist" }, { status: 400 });
    }

    const bytes = data.file ? Buffer.from(await data.file.arrayBuffer()) : null;

    const updated = await prisma.studyMaterial.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        topic: data.topic,
        materialType: data.materialType as never,
        visibility: data.visibility as never,
        departmentName: data.departmentName,
        programId: data.programId,
        semester: data.semester,
        subjectId: data.subjectId,
        ...(bytes
          ? {
              fileName: data.file!.name,
              mimeType: data.file!.type || null,
              fileSize: bytes.byteLength,
              fileData: bytes,
            }
          : {}),
        classLinks:
          data.visibility === "CLASSES"
            ? { deleteMany: {}, create: [...new Set(data.classIds)].map((classId) => ({ classId })) }
            : { deleteMany: {} },
      },
      select: { id: true },
    });

    return NextResponse.json({ message: "Study material updated", material: updated });
  } catch (error) {
    console.error("PATCH /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Unable to update study material" }, { status: 500 });
  }
}

/** DELETE /api/materials/[id] — remove an upload (owner or admin). */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
      select: { id: true, uploaderId: true, title: true },
    });
    if (!material || !(await isUploaderOrAdmin(session, material))) {
      return NextResponse.json({ error: "Study material not found" }, { status: 404 });
    }

    await prisma.studyMaterial.delete({ where: { id } });
    return NextResponse.json({ message: `Deleted "${material.title}"` });
  } catch (error) {
    console.error("DELETE /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Unable to delete study material" }, { status: 500 });
  }
}

