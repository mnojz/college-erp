import { PublicCatalog } from "@/app/components/public/PublicCatalog";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function FeeStructurePage() {
  return (
    <PublicLayout>
      <PublicCatalog
        kind="fees"
        eyebrow="Student finance"
        title="Fee Structure"
        description="Review published programme and semester fee information before registration."
      />
    </PublicLayout>
  );
}