import { PublicSyllabusLibrary } from "@/app/components/public/PublicSyllabusLibrary";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function SyllabusPage() {
  return (
    <PublicLayout>
      <section style={{ maxWidth: "1140px", margin: "0 auto", padding: "32px 20px 56px" }}>
        <header style={{ marginBottom: "20px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: 800 }}>
            Syllabus Library
          </h1>
          <p style={{ margin: 0, color: "var(--ink-soft)", maxWidth: "680px" }}>
            Browse official syllabus outlines published by FWU departments —
            organized by program and semester, with downloadable PDFs.
          </p>
        </header>
        <PublicSyllabusLibrary />
      </section>
    </PublicLayout>
  );
}
