import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  parseSyllabusForm,
  serializeSyllabus,
} from "@/app/lib/syllabi-server";
import { type SyllabusDto } from "@/app/lib/syllabi-shared";

/**
 * GET /api/syllabus — public syllabus library listing.
 *
 * No authentication required (public-domain content). Supports filtering:
 *   ?q=            search by title / program code / program name / department
 *   ?department=   filter by department name
 *   ?programId=    filter by program
 *   ?semester=     filter by semester (1..8)
 *
 * Results are sorted by department → program → semester for stable grouping.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const department = (searchParams.get("department") ?? "").trim();
    const programId = (searchParams.get("programId") ?? "").trim();
    const semesterRaw = (searchParams.get("semester") ?? "").trim();
    const semester = semesterRaw ? Number.parseInt(semesterRaw, 10) : null;

    const AND: Array<Record<string, unknown>> = [];

    if (department) AND.push({ departmentName: department });
    if (programId) AND.push({ programId });
    if (semester && Number.isFinite(semester) && semester >= 1 && semester <= 8) {
      AND.push({ semester });
    }

    if (q) {
      AND.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { fileName: { contains: q, mode: "insensitive" } },
          { departmentName: { contains: q, mode: "insensitive" } },
          { program: { name: { contains: q, mode: "insensitive" } } },
          { program: { code: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const rows = await prisma.syllabus.findMany({
      where: { AND: AND.length ? AND : undefined },
      orderBy: [
        { departmentName: "asc" },
        { program: { name: "asc" } },
        { semester: "asc" },
        { createdAt: "desc" },
      ],
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
        program: {
          select: { id: true, name: true, code: true, departmentName: true },
        },
      },
    });

    const syllabi: SyllabusDto[] = rows.map(serializeSyllabus);
    return NextResponse.json({ syllabi });
  } catch (error) {
    console.error("GET /api/syllabus error:", error);
    return NextResponse.json({ error: "Unable to load syllabi" }, { status: 500 });
  }
}

/**
 * POST /api/syllabus — upload a new syllabus (admin only, multipart/form-data).
 * Fields: title (optional), departmentName, programId, semester, file (PDF).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = await parseSyllabusForm(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.file) {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await data.file.arrayBuffer());

    const syllabus = await prisma.syllabus.create({
      data: {
        title: data.title,
        departmentName: data.departmentName,
        programId: data.programId,
        semester: data.semester,
        fileName: data.file.name,
        mimeType: data.file.type || "application/pdf",
        fileSize: bytes.byteLength,
        fileData: bytes,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { message: "Syllabus uploaded", syllabus: { id: syllabus.id } },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/syllabus error:", error);
    return NextResponse.json({ error: "Unable to upload syllabus" }, { status: 500 });
  }
}


