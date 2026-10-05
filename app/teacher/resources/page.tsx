import { Suspense } from "react";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { TeacherResourcesTabs } from "@/app/components/teacher/TeacherResourcesTabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherResourcesPage() {
  return (
    <TeacherShell
      active="/teacher/resources"
      title="Academic Resources"
      subtitle="Read-only syllabus, course structure and fee information"
    >
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <TeacherResourcesTabs />
      </Suspense>
    </TeacherShell>
  );
}
