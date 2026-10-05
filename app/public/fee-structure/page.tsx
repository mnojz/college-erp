import { PublicCatalog } from "@/app/components/public/PublicCatalog";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function FeeStructurePage() {
  return (
    <PublicLayout>
      <PublicCatalog
        kind="fees"
        eyebrow="Student finance"
        title="Fee Structure"
        description="Programmes covered by the college fee structure, and published fee amounts once available."
      />
    </PublicLayout>
  );
}