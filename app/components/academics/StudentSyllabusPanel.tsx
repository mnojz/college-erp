"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import { SyllabusPreviewModal } from "@/app/components/syllabi/SyllabusPreviewModal";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { IconFileDescription } from "@tabler/icons-react";

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

interface Props {
  initialProfile?: Profile | null;
}

export function StudentSyllabusPanel({ initialProfile }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [syllabi, setSyllabi] = useState<SyllabusDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewSyllabus, setPreviewSyllabus] = useState<SyllabusDto | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const fetchProfile = !initialProfile;
        const [profileRes, listRes, metaRes] = await Promise.all([
          fetchProfile ? fetch("/api/student/profile") : Promise.resolve(null),
          fetch("/api/syllabus"),
          fetch("/api/syllabus/meta"),
        ]);

        if (profileRes) {
          if (profileRes.status === 401 || profileRes.status === 403) {
            router.replace("/dashboard");
            return;
          }
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setProfile(profileData.student);
          }
        }

        if (!listRes.ok) throw new Error("Unable to load syllabus");
        const listData = await listRes.json();
        setSyllabi(listData.syllabi ?? []);

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMeta({
            departments: metaData.departments ?? [],
            programs: metaData.programs ?? [],
          });
        }
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabus");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, initialProfile]);

  const rawGroups = useSyllabusProgramGroups(syllabi, meta.programs);

  const myProgramId = profile?.program?.id;

  // If student is enrolled in a program, prioritize that program at the top
  const groups = useMemo(() => {
    if (!myProgramId) return rawGroups;
    return [...rawGroups].sort((a, b) => {
      const aIsMine = a.program?.id === myProgramId;
      const bIsMine = b.program?.id === myProgramId;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return 0;
    });
  }, [rawGroups, myProgramId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="border-b bg-muted/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <div key={s} className="rounded-xl border border-dashed border-border/70 p-3 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {syllabi.length > 0 ? (
        <SyllabusProgramSections
          variant="public"
          groups={groups}
          onPreview={(s) => setPreviewSyllabus(s)}
        />
      ) : (
        !error && (
          <div className="rounded-2xl border border-dashed bg-card/60 p-12 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <IconFileDescription size={24} />
            </div>
            <h3 className="text-base font-semibold text-foreground">No syllabus found</h3>
            <p className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
              No syllabus files are currently available for your academic program.
            </p>
          </div>
        )
      )}

      {/* On-Page PDF Preview Modal */}
      <SyllabusPreviewModal
        syllabus={previewSyllabus}
        onClose={() => setPreviewSyllabus(null)}
      />
    </div>
  );
}
