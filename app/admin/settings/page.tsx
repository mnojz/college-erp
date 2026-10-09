import { AdminShell } from "@/app/components/admin/AdminShell";
import { AcademicYearCard } from "@/app/components/admin/AcademicYearCard";
import { AttendancePolicyCard } from "@/app/components/admin/AttendancePolicyCard";

export default function AdminSettingsPage() {
  return (
    <AdminShell
      title="Settings"
      subtitle="Institution-wide academic policies"
      active="/admin/settings"
    >
      <AcademicYearCard />
      <AttendancePolicyCard />
    </AdminShell>
  );
}
