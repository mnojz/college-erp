import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { CourseStructureViewer } from "@/app/components/public/CourseStructureViewer";

export default function CourseStructurePage() {
  return (
    <PublicLayout>
      <div className="public-page-body">
        <section className="public-page-intro">
          <span className="badge badge-blue" style={{ marginBottom: "12px" }}>
            Academic catalogue
          </span>
          <h1 style={{ margin: "6px 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700 }}>
            Course Structure
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: "15px", lineHeight: 1.6, maxWidth: "680px" }}>
            Explore the current course map, credit assignments, and departmental structure.
          </p>
        </section>

        <CourseStructureViewer />
      </div>
    </PublicLayout>
  );
}