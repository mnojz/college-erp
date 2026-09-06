import { PublicSyllabusLibrary } from "@/app/components/public/PublicSyllabusLibrary";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function SyllabusPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Syllabus Library</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Browse official syllabus outlines published by FWU departments —
            organized by program and semester, with downloadable PDFs.
          </p>
        </div>
        <PublicSyllabusLibrary />
      </section>
    </PublicLayout>
  );
}
