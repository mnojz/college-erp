"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCertificate,
  IconChevronRight,
  IconClipboardCheck,
  IconClock,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamSession, ExamType } from "@/app/types/exam";

const TYPE_LABEL: Record<ExamType, string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

type RegistrationState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; exam: ExamSession; deadlineOpen: boolean }
  | { status: "error"; message: string };

function shell(children: React.ReactNode) {
  return (
    <StudentShell active="/student/exams" title="Exams" subtitle="Exam sessions and registrations">
      <div className="flex flex-col gap-5">{children}</div>
    </StudentShell>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <div className="text-muted-foreground">{icon}</div>
        <p className="font-heading text-base font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/** The single exam card — styled like the admin list card and linking into
 *  the detail page where the routine and registration form live. */
function ExamCard({ exam, deadlineOpen }: { exam: ExamSession; deadlineOpen: boolean }) {
  return (
    <Link href={`/student/exams/${exam.id}`} className="block">
      <Card className="rounded-xl transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconCertificate size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading truncate font-semibold">{exam.title}</p>
                <Badge variant="outline" className="border-transparent bg-primary/15 text-primary">
                  {TYPE_LABEL[exam.type]}
                </Badge>
                {exam.isBacklog && (
                  <Badge variant="outline" className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    Backlog
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Semester {exam.semester}
                {exam.program ? ` · ${exam.program.name}` : ""}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconCalendarEvent size={14} aria-hidden="true" />
                {exam.registrationDeadline
                  ? `Form deadline: ${new Date(exam.registrationDeadline).toLocaleString("en-GB")}`
                  : "No form deadline set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`gap-1.5 border-transparent ${
                deadlineOpen
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <IconClock size={13} aria-hidden="true" />
              {deadlineOpen ? "Registration open" : "Registration closed"}
            </Badge>
            <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
              View &amp; register
              <IconChevronRight size={16} aria-hidden="true" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function StudentExamsPage() {
  const [state, setState] = useState<RegistrationState>({ status: "loading" });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/student/exams", { cache: "no-store" });
        if (res.status === 404) {
          setState({ status: "empty" });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({ status: "error", message: body.error ?? "Unable to load exams" });
          return;
        }
        const data = await res.json();
        setState({
          status: "ready",
          exam: data.exam,
          deadlineOpen: typeof data.window?.open === "boolean" ? data.window.open : true,
        });
      } catch {
        setState({ status: "error", message: "Unable to load exams" });
      }
    }

    load();
  }, []);

  return shell(
    <>
      {state.status === "loading" && (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {state.status === "empty" && (
        <EmptyState
          icon={<IconClipboardCheck size={40} aria-hidden="true" />}
          title="No exam session available"
          description="No exam has been announced for you yet. Your exam form will appear here once the session for your semester is announced."
        />
      )}

      {state.status === "error" && (
        <EmptyState
          icon={<IconAlertTriangle size={40} aria-hidden="true" />}
          title="Unable to load exams"
          description={state.message}
        />
      )}

      {state.status === "ready" && <ExamCard exam={state.exam} deadlineOpen={state.deadlineOpen} />}

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
      >
        Back to dashboard
      </Link>
    </>,
  );
}
