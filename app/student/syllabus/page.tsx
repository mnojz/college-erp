import { redirect } from "next/navigation";

/** Syllabus now lives in the Academics hub (/student/academics?tab=syllabus). */
export default function StudentSyllabiPage() {
  redirect("/student/academics?tab=syllabus");
}
