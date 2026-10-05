"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStructureViewer } from "@/app/components/public/CourseStructureViewer";
import { StudentSubjectsPanel } from "@/app/components/academics/StudentSubjectsPanel";
import { StudentSyllabusPanel } from "@/app/components/academics/StudentSyllabusPanel";

const TABS = ["structure", "subjects", "syllabus"] as const;
type Tab = (typeof TABS)[number];

/**
 * Student "Academics" hub — Course Structure (default), Subjects and Syllabus.
 * The panels are the exact bodies of the old standalone pages, so the public
 * course-structure viewer is reused verbatim.
 */
export function AcademicsTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    TABS.includes(requested as Tab) ? (requested as Tab) : "structure",
  );
  const [programId, setProgramId] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/profile")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          router.replace("/dashboard");
          return;
        }
        setProgramId(data.student?.program?.id ?? "");
      })
      .catch(() => undefined)
      .finally(() => setProfileLoading(false));
  }, [router]);

  function handleTabChange(next: string) {
    setTab(next as Tab);
    router.replace(`/student/academics?tab=${next}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="structure">Course Structure</TabsTrigger>
        <TabsTrigger value="subjects">Subjects</TabsTrigger>
        <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
      </TabsList>

      <TabsContent value="structure" className="mt-5">
        {profileLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <CourseStructureViewer defaultProgramId={programId || undefined} />
        )}
      </TabsContent>
      <TabsContent value="subjects" className="mt-5">
        <StudentSubjectsPanel />
      </TabsContent>
      <TabsContent value="syllabus" className="mt-5">
        <StudentSyllabusPanel />
      </TabsContent>
    </Tabs>
  );
}
