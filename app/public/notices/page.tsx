import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { AnnouncementsBoard } from "@/app/components/announcements/AnnouncementsBoard";

export default function NoticesPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <AnnouncementsBoard
          variant="public"
          showHeader
          eyebrow="Campus Bulletin"
          title="Notices & Announcements"
          subtitle="Read official university bulletins, academic calendar updates, examination schedules, and campus circulars."
        />
      </div>
    </PublicLayout>
  );
}
