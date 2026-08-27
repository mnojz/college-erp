import type { Prisma } from "@/app/generated/prisma/client";
import type { Session } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import type { StudyMaterialDto } from "@/app/lib/materials-shared";

/**
 * Server-side helpers shared by the Notes / Study Materials API routes.
 *
 * Core design principle: academic metadata drives DISCOVERABILITY while an
 * explicit `visibility` field governs ACCESS. A student's usable identity for
 * access checks is (program, currentSemester) plus the departments/programs of
 * their curriculum — matching how schedules & subjects are already scoped in
 * this ERP (there is no direct student↔class-slot link today).
 */

type Viewer = Pick<Session, "userId" | "role">;

type SerializedRow = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  materialType: string;
  visibility: string;
  departmentName: string | null;
  programId: string | null;
  subjectId: string | null;
  semester: number | null;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  program: { id: string; name: string; code: string; departmentName: string } | null;
  subject: { id: string; name: string; code: string } | null;
  uploader: { id: string; firstName: string; lastName: string } | null;
  bookmarks: unknown[];
  _count?: { bookmarks: number; classLinks: number };
};

export function serializeStudyMaterial(row: SerializedRow): StudyMaterialDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    topic: row.topic,
    materialType: row.materialType,
    visibility: row.visibility,
    departmentName: row.departmentName,
    programId: row.programId,
    subjectId: row.subjectId,
    semester: row.semester,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    bookmarked: Array.isArray(row.bookmarks) && row.bookmarks.length > 0,
    bookmarkCount: row._count?.bookmarks ?? 0,
    subject: row.subject,
    program: row.program,
    uploader: row.uploader
      ? { id: row.uploader.id, name: `${row.uploader.firstName} ${row.uploader.lastName}`.trim() }
      : { id: "", name: "Faculty" },
  };
}

/** Distinct (programId, semester) academic context relevant to the viewer. */
async function viewerAcademicContext(viewer: Viewer) {
  if (viewer.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: viewer.userId },
      select: {
        programId: true,
        currentSemester: true,
        program: { select: { id: true, departmentName: true } },
      },
    });
    if (!student) {
      return { programIds: [] as string[], semestersByProgram: new Map<string, number[]>(), departments: [] as string[] };
    }
    const programIds = student.programId ? [student.programId] : [];
    const semestersByProgram = new Map<string, number[]>();
    if (student.programId && student.currentSemester != null) {
      semestersByProgram.set(student.programId, [student.currentSemester]);
    }
    return {
      programIds,
      semestersByProgram,
      departments: student.program?.departmentName ? [student.program.departmentName] : [],
    };
  }

  if (viewer.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: viewer.userId },
      select: { classes: { select: { programId: true, semester: true } } },
    });
    const programIds = [...new Set((teacher?.classes ?? []).map((c) => c.programId))];
    const semestersByProgram = new Map<string, number[]>();
    for (const c of teacher?.classes ?? []) {
      const list = semestersByProgram.get(c.programId) ?? [];
      if (!list.includes(c.semester)) list.push(c.semester);
      semestersByProgram.set(c.programId, list);
    }
    const departments = programIds.length
      ? (
          await prisma.program.findMany({
            where: { id: { in: programIds } },
            select: { departmentName: true },
            distinct: ["departmentName"],
          })
        ).map((p) => p.departmentName)
      : [];
    return { programIds, semestersByProgram, departments };
  }

  // ADMIN sees everything — no scoping context needed
  return null;
}

/**
 * OR-scopes describing everything the viewer may access — including their own
 * uploads (owners always retain access to restricted material).
 */
export async function viewerAccessScopes(viewer: Viewer): Promise<Prisma.StudyMaterialWhereInput[]> {
  if (viewer.role === "ADMIN") return [];

  const scopes: Prisma.StudyMaterialWhereInput[] = [
    { visibility: "EVERYONE" },
    { uploaderId: viewer.userId }, // owners keep full control of their uploads
  ];

  const ctx = await viewerAcademicContext(viewer);
  if (!ctx) return scopes;

  if (ctx.departments.length) {
    scopes.push({ visibility: "DEPARTMENT_PROGRAM", departmentName: { in: ctx.departments } });
  }

  if (ctx.programIds.length) {
    scopes.push({
      visibility: "DEPARTMENT_PROGRAM",
      programId: { in: ctx.programIds },
    });

    // "Specific Classes": a teaching group = (program, semester) pair of any
    // linked schedule slot. This mirrors how class rosters are derived across
    // the ERP (attendance/assessments filter by program + semester).
    const classFilters = ctx.programIds.flatMap((programId) => {
      const semesters = ctx.semestersByProgram.get(programId);
      if (!semesters?.length) return [];
      return [{ programId, semester: { in: semesters } }];
    });

    if (classFilters.length) {
      scopes.push({
        visibility: "CLASSES",
        classLinks: {
          some: { class: { OR: classFilters } },
        },
      });
    }
  }

  return scopes;
}

export async function canViewerAccessMaterial(viewer: Viewer, materialId: string): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;

  const scopes = await viewerAccessScopes(viewer);
  const found = await prisma.studyMaterial.findFirst({
    where: { id: materialId, OR: scopes },
    select: { id: true },
  });
  return Boolean(found);
}

export async function isUploaderOrAdmin(viewer: Viewer, material: { uploaderId: string }): Promise<boolean> {
  return viewer.role === "ADMIN" || material.uploaderId === viewer.userId;
}

/* ─── Upload/edit form parsing & validation ─────────────────── */

import {
  BLOCKED_EXTENSIONS,
  MATERIAL_TYPE_VALUES,
  MAX_FILE_BYTES,
  VISIBILITY_VALUES,
} from "@/app/lib/materials-shared";

export type MaterialFormPayload = {
  title: string;
  description: string | null;
  topic: string | null;
  materialType: string;
  visibility: string;
  departmentName: string | null;
  programId: string | null;
  semester: number | null;
  subjectId: string | null;
  classIds: string[];
  file: File | null;
};

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function parseMaterialForm(
  request: Request,
): Promise<{ data: MaterialFormPayload } | { error: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: "Invalid multipart form submission" };
  }

  const title = str(form, "title");
  if (!title) return { error: "Title is required" };
  if (title.length > 200) return { error: "Title is too long (max 200 characters)" };

  const materialType = str(form, "materialType");
  if (!MATERIAL_TYPE_VALUES.includes(materialType)) return { error: "Invalid material type" };

  const visibility = str(form, "visibility") || "EVERYONE";
  if (!VISIBILITY_VALUES.includes(visibility)) return { error: "Invalid visibility option" };

  const semesterRaw = str(form, "semester");
  let semester: number | null = null;
  if (semesterRaw) {
    semester = Number.parseInt(semesterRaw, 10);
    if (!Number.isFinite(semester) || semester < 1 || semester > 12) {
      return { error: "Semester must be between 1 and 12" };
    }
  }

  let classIds: string[] = [];
  const classIdsRaw = str(form, "classIds");
  if (classIdsRaw) {
    try {
      const parsed: unknown = JSON.parse(classIdsRaw);
      if (Array.isArray(parsed)) {
        classIds = parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
    } catch {
      return { error: "Invalid class selection" };
    }
  }
  if (visibility === "CLASSES" && classIds.length === 0) {
    return { error: "Select at least one class for restricted visibility" };
  }

  const rawFile = form.get("file");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: `File is too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB)` };
    }
    const lowerName = file.name.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      return { error: "This file type is not allowed" };
    }
  }

  return {
    data: {
      title,
      description: str(form, "description") || null,
      topic: str(form, "topic") || null,
      materialType,
      visibility,
      departmentName: str(form, "departmentName") || null,
      programId: str(form, "programId") || null,
      semester,
      subjectId: str(form, "subjectId") || null,
      classIds,
      file,
    },
  };
}



