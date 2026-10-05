"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { campusDayOfWeek } from "@/app/lib/campus-time";
import { formatTime } from "@/app/lib/timetable-layout";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

type ClassSchedule = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string; code: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
  };
  semester: number;
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

const weekDays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

export default function TeacherSchedulePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response = await fetch("/api/teacher/profile");
        if (response.status === 401 || response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load teaching schedule");
          return;
        }

        setClasses(data.teacher?.classes ?? []);
        if (data.teacher) {
          setTeacherInfo({
            firstName: data.teacher.user.firstName,
            lastName: data.teacher.user.lastName,
            employeeNo: data.teacher.employeeNo,
            profileImageUrl: data.teacher.profileImageUrl,
          });
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [router]);

  if (error) {
    return (
      <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">
        <p>{error}</p>
      </main>
    );
  }

  if (loading) {
    return <main className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Loading teaching schedule...</main>;
  }

  const todayDayName = campusDayOfWeek();

  // Calculate stats
  const activeDays = new Set(classes.map((c) => c.dayOfWeek)).size;
  const uniqueSubjects = new Set(classes.map((c) => c.subject.code)).size;

  return (
    <TeacherShell
      active="/teacher/schedule"
      title="Weekly Teaching Schedule"
      subtitle="Faculty Timetable & Lectures"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {/* Metric Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Weekly Lecture Sessions</span>
          <strong>{classes.length}</strong>
          <small>Scheduled class slots</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Teaching Days</span>
          <strong className="text-primary">{activeDays} Days</strong>
          <small>Per academic week</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Unique Subjects</span>
          <strong className="text-violet-600 dark:text-violet-400">{uniqueSubjects}</strong>
          <small>Distinct courses taught</small>
        </article>
      </section>

      {/* Schedule by Day */}
      <div className="grid gap-5">
        {weekDays.map((day) => {
          const dayClasses = classes.filter((c) => c.dayOfWeek === day);
          const isToday = day === todayDayName;

          return (
            <section
              key={day}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-xs",
                isToday && "border-l-4 border-l-primary bg-primary/3",
              )}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="m-0 p-0 text-[1.05rem] font-bold">
                    {day}
                  </h2>
                  {isToday && (
                    <Badge variant="default">TODAY</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {dayClasses.length} {dayClasses.length === 1 ? "Session" : "Sessions"}
                </span>
              </div>

              {dayClasses.length === 0 ? (
                <p className="mt-3.5 mb-1 text-sm text-muted-foreground">
                  No scheduled classes for {day.toLowerCase()}.
                </p>
              ) : (
                <div className="mt-3.5 grid gap-3">
                  {dayClasses.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-[10px] border bg-card px-4 py-3.5"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="px-3 py-1.5 text-sm">
                          {item.subject.code}
                        </Badge>
                        <div>
                          <strong className="block text-[0.95rem]">
                            {item.subject.name}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            Program: {item.program.name} ({item.program.code}) · Semester {item.semester}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">
                          {formatTime(item.startTime)} – {formatTime(item.endTime)}
                        </div>
                        <span className="text-[0.75rem] text-muted-foreground">
                          Lecture Hall
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </TeacherShell>
  );
}
