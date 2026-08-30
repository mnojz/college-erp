import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import StudentPage from "@/app/student/page";
import TeacherOverviewPage from "@/app/teacher/page";
import AdminPage from "@/app/admin/page";

export const dynamic = "force-dynamic";

/**
 * Single dashboard endpoint for every role. The URL is `/dashboard` for
 * everyone; the content rendered depends on the session role, so a user
 * always lands on their own role's dashboard (student / teacher / admin)
 * and only their own account's data is shown.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  switch (session.role) {
    case "STUDENT":
      return <StudentPage />;
    case "TEACHER":
      return <TeacherOverviewPage />;
    case "ADMIN":
      return <AdminPage />;
    default:
      redirect("/login");
  }
}



