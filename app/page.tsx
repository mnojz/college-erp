import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "TEACHER") {
    redirect("/teacher/attendance");
  }

  if (session.role === "ADMIN") {
    redirect("/admin");
  }

  redirect("/student");
}
