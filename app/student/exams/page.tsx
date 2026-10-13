"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconClipboardCheck,
  IconClock,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamPart, ExamSession, ExamSubject } from "@/app/types/exam";

type RegistrationState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; exam: ExamSession; subjects: ExamSubject[]; deadlineOpen: boolean }
  | { status: "error"; message: string };

/** Per-subject feedback: which id is currently registering, and the last result. */
type Feedback = { registeringId: string | null; message: string | null; ok: boolean };

function shell(children: React.ReactNode) {
  return (
    <StudentShell active="/student/exams" title="Exams" subtitle="Register for your exam parts">
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

export default function StudentExamsPage() {
  const [state, setState] = useState<RegistrationState>({ status: "loading" });
  const [feedback, setFeedback] = useState<Feedback>({
    registeringId: null,
    message: null,
    ok: true,
  });
  // Bumping this re-runs the fetch effect (used to refresh after a registration).
  const [reloadKey, setReloadKey] = useState(0);

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
          const message = body.error ?? "Unable to load exams";
          setState({ status: "error", message });
          return;
        }
        const data = await res.json();
        setState({
          status: "ready",
          exam: data.exam,
          subjects: data.subjects,
          deadlineOpen: typeof data.window?.open === "boolean" ? data.window.open : true,
        });
      } catch {
        setState({ status: "error", message: "Unable to load exams" });
      }
    }

    load();
  }, [reloadKey]);

  async function register(examId: string, subjectId: string, part: ExamPart) {
    setFeedback({ registeringId: subjectId, message: null, ok: true });
    try {
      const res = await fetch(`/api/student/exams/${examId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSubjectId: subjectId, part }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          registeringId: null,
          message: body.error ?? "Registration failed",
          ok: false,
        });
        return;
      }
      // On success the part is consumed from the eligible list, so reload.
      setFeedback({ registeringId: null, message: null, ok: true });
      setReloadKey((k) => k + 1);
    } catch {
      setFeedback({ registeringId: null, message: "Registration failed", ok: false });
    }
  }

  if (state.status === "loading") {
    return shell(
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>,
    );
  }

  if (state.status === "empty") {
    return shell(
      <EmptyState
        icon={<IconClipboardCheck size={40} stroke={1.5} />}
        title="No exams to register for"
        description="There are no announced exam sessions for you to register for right now. Check back once your department announces an exam."
      />,
    );
  }

  if (state.status === "error") {
    return shell(
      <EmptyState
        icon={<IconAlertTriangle size={40} stroke={1.5} />}
        title="Unable to load exams"
        description={state.message}
      />,
    );
  }

  const { exam, subjects, deadlineOpen } = state;

  return shell(
    <>
      {/* Session summary */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconClipboardCheck size={22} stroke={1.8} />
              </div>
              <div>
                <p className="font-heading text-base font-medium">{exam.title}</p>
                <p className="text-sm text-muted-foreground">
                  Semester {exam.semester}
                  {exam.program ? ` · ${exam.program.name}` : ""}
                </p>
              </div>
            </div>
            <Badge variant={deadlineOpen ? "default" : "secondary"} className="gap-1.5 px-3 py-1.5">
              <IconClock size={14} aria-hidden="true" />
              {deadlineOpen ? "Registration open" : "Registration closed"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <IconCalendarEvent size={16} aria-hidden="true" />
            {exam.registrationDeadline ? (
              <span>
                Submit your part before{" "}
                {new Date(exam.registrationDeadline).toLocaleString()}
              </span>
            ) : (
              <span>Registration is open</span>
            )}
            {exam.isBacklog && (
              <Badge variant="outline" className="ml-1">
                Backlog
              </Badge>
            )}
          </div>

          {feedback.message && !feedback.ok && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {feedback.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Eligible parts */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {subjects.length > 0
            ? "Parts you can register for"
            : "You have already registered for all eligible parts."}
        </p>

        {subjects.map((s) => {
          const busy = feedback.registeringId === s.id;
          return (
            <Card key={`${s.id}-${s.part}`} size="sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={s.part === "THEORY" ? "default" : "secondary"}>
                    {s.part === "THEORY" ? "Theory" : "Practical"}
                  </Badge>
                  <div>
                    <div className="font-medium">
                      {s.code} — {s.name}
                    </div>
                    <div className="text-sm text-muted-foreground">{s.maxMarks} marks</div>
                  </div>
                </div>

                {deadlineOpen ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void register(exam.id, s.id, s.part);
                    }}
                  >
                    {busy ? "Registering…" : `Register for ${s.part === "THEORY" ? "Theory" : "Practical"}`}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Deadline passed — form closed.
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
      >
        Back to dashboard
      </Link>
    </>,
  );
}
