"use client";

import { useEffect, useState } from "react";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import { SyllabusPreviewModal } from "@/app/components/syllabi/SyllabusPreviewModal";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { IconFileDescription } from "@tabler/icons-react";

type Syllabus = SyllabusDto;

export function PublicSyllabusLibrary() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewSyllabus, setPreviewSyllabus] = useState<Syllabus | null>(null);

  useEffect(() => {
    async function load() {
      try {
        startProgress();
        const [listRes, metaRes] = await Promise.all([
          fetch("/api/syllabus"),
          fetch("/api/syllabus/meta"),
        ]);
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
        doneProgress();
      }
    }
    load();
  }, []);

  const groups = useSyllabusProgramGroups(syllabi, meta.programs);

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
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
      ) : syllabi.length > 0 ? (
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
              No syllabus files are currently available in the public library.
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
