import { redirect } from "next/navigation";

/** Subjects now live in the Academics hub (/student/academics?tab=subjects). */
export default function StudentSubjectsPage() {
  redirect("/student/academics?tab=subjects");
}
