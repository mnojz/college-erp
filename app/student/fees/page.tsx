import { StudentShell } from "@/app/components/student/StudentShell";
import { PublicCatalog } from "@/app/components/public/PublicCatalog";

export default function StudentFeesPage() {
  // No title/subtitle: PublicCatalog renders its own page heading, so a shell
  // heading would be duplicate chrome.
  return (
    <StudentShell active="/student/fees">
      <div className="flex flex-col gap-5">
        {/*
          FUTURE: personal finance summary for this student (total fee, amount
          due, paid, instalments, next due date). Add it ABOVE the catalogue —
          this page is role-scoped and auth-guarded, so it can show private
          numbers while the public fee page keeps sharing the same component.
        */}
        <PublicCatalog
          kind="fees"
          eyebrow="Student finance"
          title="Fee Structure"
          description="Programmes covered by the college fee structure, and published fee amounts once available."
        />
      </div>
    </StudentShell>
  );
}
