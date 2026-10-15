"use client";

import { StudentCourseStructurePanel } from "@/app/components/academics/StudentCourseStructurePanel";

export function CourseStructureViewer({
  defaultProgramId,
}: { defaultProgramId?: string } = {}) {
  return <StudentCourseStructurePanel defaultProgramId={defaultProgramId} />;
}
