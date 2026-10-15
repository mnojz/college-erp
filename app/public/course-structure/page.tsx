import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { CourseStructureViewer } from "@/app/components/public/CourseStructureViewer";

export default function CourseStructurePage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Curriculum</h1>
        </div>

        <CourseStructureViewer />
      </div>
    </PublicLayout>
  );
}
