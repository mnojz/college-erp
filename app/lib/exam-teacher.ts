import { prisma } from "@/app/lib/prisma";
import { marksEntryRole } from "@/app/lib/exams";

/** Resolve an ExamSubject and verify the signed-in teacher may enter its marks.
 * Returns null when not found or not owned (caller responds 403/404). */
export async function resolveTeacherExamSubject(sessionId: string, examSubjectId: string, userId: string) {
  const examSubject = await prisma.examSubject.findFirst({
    where: {
      id: examSubjectId,
      sessionId,
      session: { resultsPublishedAt: null },
      subject: { subjectTeachers: { some: { teacher: { userId } } } },
    },
    select: {
      id: true,
      part: true,
      maxMarks: true,
      marksPublishedAt: true,
      session: {
        select: { id: true, title: true, type: true, status: true, semester: true, programId: true },
      },
      subject: { select: { id: true, code: true, name: true } },
    },
  });
  if (!examSubject) return null;

  // An END_SEMESTER THEORY part is admin-entered only.
  if (marksEntryRole(examSubject.session.type, examSubject.part) !== "TEACHER") return null;

  return examSubject;
}