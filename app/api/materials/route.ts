import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { MATERIAL_TYPE_VALUES } from "@/app/lib/materials-shared";
import {
  parseMaterialForm,
  serializeStudyMaterial,
  viewerAccessScopes,
} from "@/app/lib/materials-server";

/**
 * GET /api/materials
 * Library listing for any authenticated user. Students see visibility-scoped
 * results; ?mine=1 narrows to the signed-in teacher's uploads.
 * Filters: q, department, programId, semester, subjectId, topic, type, uploaderId, limit.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "1";
    const q = (searchParams.get("q") ?? "").trim();
    const department = (searchParams.get("department") ?? "").trim();
    const programId = (searchParams.get("programId") ?? "").trim();
    const semester = Number.parseInt(searchParams.get("semester") ?? "", 10);
    const subjectId = (searchParams.get("subjectId") ?? "").trim();
    const topic = (searchParams.get("topic") ?? "").trim();
    const type = (searchParams.get("type") ?? "").trim();
    const uploaderId = (searchParams.get("uploaderId") ?? "").trim();
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 300;

    // Access scoping — academic metadata drives discoverability per role.
    const scope = await viewerAccessScopes(session);
    const AND: Prisma.StudyMaterialWhereInput[] = scope.length ? [{ OR: scope }] : [];

    if (mine) {
      if (!["TEACHER", "ADMIN"].includes(session.role)) {
        return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
      }
      AND.push({ uploaderId: session.userId });
    }

    if (q) {
      AND.push({
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { topic: { contains: q, mode: "insensitive" as const } },
          { subject: { name: { contains: q, mode: "insensitive" as const } } },
          { subject: { code: { contains: q, mode: "insensitive" as const } } },
          { program: { name: { contains: q, mode: "insensitive" as const } } },
          { departmentName: { contains: q, mode: "insensitive" as const } },
        ],
      });
    }
    if (department) AND.push({ departmentName: department });
    if (programId) AND.push({ programId });
    if (Number.isFinite(semester)) AND.push({ semester });
    if (subjectId) AND.push({ subjectId });
    if (topic) AND.push({ topic: { contains: topic, mode: "insensitive" as const } });
    if (type && MATERIAL_TYPE_VALUES.includes(type)) AND.push({ materialType: type as never });
    if (uploaderId) AND.push({ uploaderId });

    const rows = await prisma.studyMaterial.findMany({
      where: { AND },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
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

    return NextResponse.json({ materials: rows.map(serializeStudyMaterial) });
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json({ error: "Unable to load study materials" }, { status: 500 });
  }
}

/** POST /api/materials — upload new study material (teachers & admins, multipart/form-data). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["TEACHER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  const parsed = await parseMaterialForm(request);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data = parsed.data;
  if (!data.file) return NextResponse.json({ error: "A file is required" }, { status: 400 });

  try {
    // Validate that referenced metadata exists (best-effort integrity).
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId }, select: { id: true } });
      if (!subject) return NextResponse.json({ error: "Selected subject does not exist" }, { status: 400 });
    }
    if (data.programId) {
      const program = await prisma.program.findUnique({ where: { id: data.programId }, select: { id: true } });
      if (!program) return NextResponse.json({ error: "Selected program does not exist" }, { status: 400 });
    }
    if (data.classIds.length) {
      const classes = await prisma.class.count({ where: { id: { in: data.classIds } } });
      if (classes !== data.classIds.length) {
        return NextResponse.json({ error: "One or more selected classes do not exist" }, { status: 400 });
      }
    }

    const bytes = Buffer.from(await data.file.arrayBuffer());
    const material = await prisma.studyMaterial.create({
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
        fileName: data.file.name,
        mimeType: data.file.type || null,
        fileSize: bytes.byteLength,
        fileData: bytes,
        uploaderId: session.userId,
        classLinks:
          data.visibility === "CLASSES"
            ? { create: [...new Set(data.classIds)].map((classId) => ({ classId })) }
            : undefined,
      },
      select: { id: true },
    });

    return NextResponse.json({ message: "Study material uploaded", material }, { status: 201 });
  } catch (error) {
    console.error("POST /api/materials error:", error);
    return NextResponse.json({ error: "Unable to upload study material" }, { status: 500 });
  }
}

