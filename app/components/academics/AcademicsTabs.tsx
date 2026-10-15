"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconBook2,
  IconCalendar,
  IconFileText,
  IconLayersLinked,
  IconSchool,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentCourseStructurePanel } from "@/app/components/academics/StudentCourseStructurePanel";
import { StudentSubjectsPanel } from "@/app/components/academics/StudentSubjectsPanel";
import { StudentSyllabusPanel } from "@/app/components/academics/StudentSyllabusPanel";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
    durationYears: number;
  } | null;
};

const TABS = ["structure", "subjects", "syllabus"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  profile?: Profile | null;
}

export function AcademicsTabs({ profile: initialProfile }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    TABS.includes(requested as Tab) ? (requested as Tab) : "structure"
  );
  const [fetchedProfile, setFetchedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!initialProfile);

  const profile = initialProfile ?? fetchedProfile;

  useEffect(() => {
    if (initialProfile) return;

    fetch("/api/student/profile")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          router.replace("/dashboard");
          return;
        }
        setFetchedProfile(data.student ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [router, initialProfile]);

  function handleTabChange(next: string) {
    setTab(next as Tab);
    router.replace(`/student/academics?tab=${next}`, { scroll: false });
  }

  if (loading && !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Main Tab Navigation ── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
          <TabsList className="bg-muted/60 p-1.5 rounded-xl h-11">
            <TabsTrigger
              value="structure"
              className="gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg h-8 sm:h-8.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconLayersLinked size={15} />
              Course Structure
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg h-8 sm:h-8.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconBook2 size={15} />
              Enrolled Subjects
            </TabsTrigger>
            <TabsTrigger
              value="syllabus"
              className="gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg h-8 sm:h-8.5 data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconFileText size={15} />
              Official Syllabus
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: COURSE STRUCTURE ── */}
        <TabsContent value="structure" className="m-0 outline-hidden">
          <StudentCourseStructurePanel
            defaultProgramId={profile?.program?.id}
            currentSemester={profile?.currentSemester}
          />
        </TabsContent>

        {/* ── TAB 2: SUBJECTS ── */}
        <TabsContent value="subjects" className="m-0 outline-hidden">
          <StudentSubjectsPanel initialProfile={profile} />
        </TabsContent>

        {/* ── TAB 3: SYLLABUS ── */}
        <TabsContent value="syllabus" className="m-0 outline-hidden">
          <StudentSyllabusPanel initialProfile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
