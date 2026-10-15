import { PublicSyllabusLibrary } from "@/app/components/public/PublicSyllabusLibrary";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function SyllabusPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Syllabus</h1>
        </div>
        <PublicSyllabusLibrary />
      </section>
    </PublicLayout>
  );
}
