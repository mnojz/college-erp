import { PublicCatalog } from "@/app/components/public/PublicCatalog";
import { PublicLayout } from "@/app/components/layout/PublicLayout";

export default function NoticesPage() {
  return (
    <PublicLayout>
      <PublicCatalog
        kind="notices"
        eyebrow="Campus bulletin"
        title="Notices and Announcements"
        description="Read public notices, academic updates, schedules, and important campus information."
      />
    </PublicLayout>
  );
}
