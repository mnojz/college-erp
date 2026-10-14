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
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Academic Hero Header ── */}
      <Card className="rounded-2xl border border-border/70 shadow-xs bg-linear-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-5 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <IconSchool size={14} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Academic Curriculum &amp; Plan
              </span>
            </div>
            <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {profile?.program?.name ?? "Academic Program"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile?.program?.departmentName || "Department of Engineering"} ·{" "}
              {profile?.program?.durationYears ? `${profile.program.durationYears} Years Duration` : "Full-Time"}
            </p>
          </div>

          {/* Current Semester Badge */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {profile?.currentSemester != null && (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-primary font-bold text-xs px-3 py-1.5 shadow-xs"
              >
                <IconCalendar size={13} className="mr-1.5" />
                Current: Semester {profile.currentSemester}
              </Badge>
            )}
            {profile?.program?.code && (
              <Badge variant="outline" className="font-mono text-xs font-bold px-2.5 py-1.5 bg-muted/60">
                {profile.program.code}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* ── Main Tab Navigation ── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger
              value="structure"
              className="gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconLayersLinked size={14} />
              Course Structure
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconBook2 size={14} />
              Enrolled Subjects
            </TabsTrigger>
            <TabsTrigger
              value="syllabus"
              className="gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconFileText size={14} />
              Official Syllabus
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-muted-foreground hidden md:inline">
            Curriculum governed by university academic council
          </span>
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
