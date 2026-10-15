import { PublicLayout } from "@/app/components/layout/PublicLayout";
import { AnnouncementsBoard } from "@/app/components/announcements/AnnouncementsBoard";

export default function NoticesPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notices</h1>
        </div>
        <AnnouncementsBoard variant="public" showHeader={false} />
      </div>
    </PublicLayout>
  );
}
