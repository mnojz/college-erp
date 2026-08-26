import { PublicCatalog } from "@/app/components/public/PublicCatalog";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function SyllabusPage() {
  return (
    <PublicLayout>
      <PublicCatalog
        kind="syllabus"
        eyebrow="Academic catalogue"
        title="Syllabus Library"
        description="Browse the official syllabus outlines and credit details published by FWU departments."
      />
    </PublicLayout>
  );
}
