import { Suspense } from "react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { AcademicsTabs } from "@/app/components/academics/AcademicsTabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentAcademicsPage() {
  return (
    <StudentShell
      active="/student/academics"
      title="Academics"
      subtitle="Course structure, your subjects and syllabus"
    >
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <AcademicsTabs />
      </Suspense>
    </StudentShell>
  );
}
