import { prisma } from "@/app/lib/prisma";
import {
  BLOCKED_EXTENSIONS,
  MAX_SYLLABUS_BYTES,
  titleFromFileName,
  type SyllabusDto,
} from "@/app/lib/syllabi-shared";

type ParsedSyllabusForm = {
  title: string | null;
  departmentName: string;
  programId: string | null;
  semester: number;
  file: File | null;
};

/** Parse + validate a multipart syllabus upload/edit submission. */
export async function parseSyllabusForm(
  request: Request,
): Promise<{ data: ParsedSyllabusForm } | { error: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: "Invalid multipart form submission" };
  }

  const title = (form.get("title") as string | null)?.trim() || null;
  const departmentName = (form.get("departmentName") as string | null)?.trim() || "";
  const programId = (form.get("programId") as string | null)?.trim() || null;
  const semesterRaw = (form.get("semester") as string | null)?.trim() || "";

  if (!departmentName) return { error: "Department is required" };

  if (!semesterRaw) return { error: "Semester is required" };
  const semester = Number.parseInt(semesterRaw, 10);
  if (!Number.isFinite(semester) || semester < 1 || semester > 8) {
    return { error: "Semester must be between 1 and 8" };
  }

  if (programId) {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) return { error: "Selected program does not exist" };
  }

  const rawFile = form.get("file");
  const file: File | null =
    rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (file) {
    if (file.size > MAX_SYLLABUS_BYTES) {
      return {
        error: `File is too large (max ${Math.round(MAX_SYLLABUS_BYTES / (1024 * 1024))} MB)`,
      };
    }
    const lowerName = file.name.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return { error: "This file type is not allowed" };
    }
    if (file.type && file.type !== "application/pdf") {
      return { error: "Only PDF files are accepted as syllabi" };
    }
  }

  return { data: { title, departmentName, programId, semester, file } };
}

/** Convert a stored Syllabus row into the client-safe DTO. */
export function serializeSyllabus(row: {
  id: string;
  title: string | null;
  departmentName: string;
  programId: string | null;
  semester: number;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  program: { id: string; name: string; code: string; departmentName: string } | null;
}): SyllabusDto {
  return {
    id: row.id,
    title: row.title,
    departmentName: row.departmentName,
    programId: row.programId,
    programCode: row.program?.code ?? null,
    programName: row.program?.name ?? null,
    semester: row.semester,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resolve a syllabus display title (fall back to a filename-derived one). */
export function resolveTitle(s: { title: string | null; fileName: string }): string {
  return s.title || titleFromFileName(s.fileName);
}
