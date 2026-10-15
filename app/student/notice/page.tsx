import { StudentShell } from "@/app/components/student/StudentShell";
import { AnnouncementsBoard } from "@/app/components/announcements/AnnouncementsBoard";

export default function StudentNoticePage() {
  return (
    <StudentShell
      active="/student/notice"
      title="Notice"
      subtitle="Campus notices and updates"
    >
      <AnnouncementsBoard variant="student" showHeader={false} />
    </StudentShell>
  );
}

