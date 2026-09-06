import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { CourseStructureViewer } from "@/app/components/public/CourseStructureViewer";
import { Badge } from "@/components/ui/badge";

export default function CourseStructurePage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-8">
          <Badge variant="secondary" className="mb-3">
            Academic catalogue
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Course Structure</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Explore the current course map, credit assignments, and departmental structure.
          </p>
        </section>

        <CourseStructureViewer />
      </div>
    </PublicLayout>
  );
}
