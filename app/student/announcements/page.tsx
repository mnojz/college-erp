import { StudentShell } from "@/app/components/student/StudentShell";
import { PublicCatalog } from "@/app/components/public/PublicCatalog";

export default function StudentAnnouncementsPage() {
  // No title/subtitle: PublicCatalog renders its own page heading, so a shell
  // heading would be duplicate chrome.
  return (
    <StudentShell active="/student/announcements">
      {/* Same component + endpoint as the public notices page. */}
      <PublicCatalog
        kind="notices"
        eyebrow="Campus bulletin"
        title="Notices and Announcements"
        description="Campus updates, academic notices and information from your teachers."
      />
    </StudentShell>
  );
}
