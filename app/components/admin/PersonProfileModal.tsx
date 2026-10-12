"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconPencil } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { formatProfileDate } from "@/app/lib/profile-shared";

type AttendanceItem = {
  id: string;
  status: string;
  session: {
    sessionDate: string;
    class: {
      dayOfWeek: string;
      type: string | null;
      subject: { code: string; name: string };
    };
  };
};

type ResultItem = {
  id: string;
  marks: number | string;
  grade: string | null;
  assessment: {
    id: string;
    name: string;
    semester: number;
    maxMarks: number | string;
    assessmentDate: string | null;
    subject: { code: string; name: string };
  };
};

type StudentDetail = {
  id: string;
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  admissionDate: string;
  currentSemester: number | null;
  gender: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  status: string;
  createdAt: string;
  program: { id: string; name: string; code: string; durationYears: number } | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    createdAt: string;
  };
  attendanceRecords: AttendanceItem[];
  results: ResultItem[];
};

type TeacherDetail = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  qualification: string | null;
  bio: string | null;
  office: string | null;
  phone: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    createdAt: string;
  };
  subjectTeachers: Array<{
    id: string;
    subject: {
      id: string;
      code: string;
      name: string;
      semester: number;
      program: { code: string; name: string } | null;
    };
  }>;
  classes: Array<{
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    semester: number;
    type: string | null;
    group: string | null;
    subject: { code: string; name: string };
    program: { code: string; name: string };
  }>;
  _count: { uploadedMaterials: number; authoredAnnouncements: number };
};

function fullName(first: string, last: string) {
  return `${first} ${last}`.trim() || "—";
}

function initials(first: string, last: string) {
  return `${first.charAt(0) ?? ""}${last.charAt(0) ?? ""}`.toUpperCase() || "–";
}

/** AccountStatusBadge — same Catppuccin convention as the directory table. */
function AccountStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return (
      <Badge className="bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]">
        Active
      </Badge>
    );
  }
  if (normalized === "INACTIVE") {
    return (
      <Badge className="bg-[color-mix(in_oklab,var(--ctp-red)_15%,transparent)] text-[var(--ctp-red)]">
        Inactive
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

/** Label/value row for the overview tab. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium break-words">{value}</span>
    </div>
  );
}

function StudentOverview({ student }: { student: StudentDetail }) {
  const present = student.attendanceRecords.filter((r) => r.status === "PRESENT").length;
  const total = student.attendanceRecords.length;
  const pct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : null;
  return (
    <>
      <DetailRow label="Enrollment no." value={<span className="font-mono">{student.enrollmentNumber}</span>} />
      <DetailRow label="Registration ID" value={<span className="font-mono">{student.registrationId}</span>} />
      <DetailRow label="Roll number" value={student.rollNumber ?? "—"} />
      <DetailRow label="Email" value={student.user.email} />
      <DetailRow label="Program" value={student.program ? `${student.program.code} — ${student.program.name}` : "—"} />
      <DetailRow label="Semester" value={student.currentSemester ?? "—"} />
      <DetailRow label="Gender" value={student.gender} />
      <DetailRow label="Nationality" value={student.nationality} />
      <DetailRow label="Religion" value={student.religion} />
      <DetailRow label="Category" value={student.category} />
      <DetailRow label="Enrollment status" value={student.status} />
      <DetailRow label="Admission date" value={formatProfileDate(student.admissionDate)} />
      <DetailRow label="Attendance (last 50)" value={pct === null ? "No records" : `${pct}% (${present}/${total})`} />
      <DetailRow label="Results" value={`${student.results.length} published`} />
    </>
  );
}

function StudentAttendance({ student }: { student: StudentDetail }) {
  if (student.attendanceRecords.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No attendance records yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {student.attendanceRecords.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">
                {formatProfileDate(r.session.sessionDate)}
              </TableCell>
              <TableCell>
                <strong className="font-mono">{r.session.class.subject.code}</strong>
                <div className="text-xs text-muted-foreground">
                  {r.session.class.subject.name}
                </div>
              </TableCell>
              <TableCell>
                <AttendanceChip status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StudentResults({ student }: { student: StudentDetail }) {
  if (student.results.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No published results yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Marks</TableHead>
            <TableHead>Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {student.results.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <strong>{r.assessment.name}</strong>
                <div className="text-xs text-muted-foreground">
                  {r.assessment.subject.code} · Sem {r.assessment.semester}
                </div>
              </TableCell>
              <TableCell className="font-semibold whitespace-nowrap">
                {Number(r.marks)} / {Number(r.assessment.maxMarks)}
              </TableCell>
              <TableCell>
                <Badge variant={Number(r.marks) >= Number(r.assessment.maxMarks) * 0.4 ? "default" : "destructive"}>
                  {r.grade ?? "—"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TeacherOverview({ teacher }: { teacher: TeacherDetail }) {
  return (
    <>
      <DetailRow label="Employee no." value={<span className="font-mono">{teacher.employeeNo}</span>} />
      <DetailRow label="Email" value={teacher.user.email} />
      <DetailRow label="Qualification" value={teacher.qualification} />
      <DetailRow label="Office" value={teacher.office} />
      <DetailRow label="Phone" value={teacher.phone} />
      <DetailRow label="About" value={teacher.bio} />
      <DetailRow label="Subjects assigned" value={teacher.subjectTeachers.length} />
      <DetailRow label="Classes scheduled" value={teacher.classes.length} />
      <DetailRow label="Materials uploaded" value={teacher._count.uploadedMaterials} />
      <DetailRow label="Announcements" value={teacher._count.authoredAnnouncements} />
    </>
  );
}

function TeacherTeaching({ teacher }: { teacher: TeacherDetail }) {
  const name = fullName(teacher.user.firstName, teacher.user.lastName);
  if (teacher.subjectTeachers.length === 0 && teacher.classes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {name} is not assigned to any subject yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {teacher.subjectTeachers.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Program · Sem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacher.subjectTeachers.map((st) => (
                <TableRow key={st.id}>
                  <TableCell>
                    <strong className="font-mono">{st.subject.code}</strong>
                    <div className="text-xs text-muted-foreground">{st.subject.name}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {st.subject.program ? `${st.subject.program.code} · ` : ""}Sem {st.subject.semester}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {teacher.classes.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacher.classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <strong className="font-mono">{c.subject.code}</strong>
                    <div className="text-xs text-muted-foreground">
                      {c.program.code} · Sem {c.semester}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {c.dayOfWeek.toLowerCase()}
                    <div className="text-xs text-muted-foreground normal-case">
                      {new Date(c.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(c.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function PersonProfileModal({
  kind,
  id,
  onClose,
  onEditProfile,
  dangerSection,
}: {
  kind: "student" | "teacher";
  id: string;
  onClose: () => void;
  onEditProfile?: () => void;
  dangerSection?: React.ReactNode;
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/person?kind=${kind}&id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Unable to load profile");
          return;
        }
        if (kind === "student") setStudent(data.student);
        else setTeacher(data.teacher);
      } catch {
        if (!cancelled) setError("Unable to reach the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const name = useMemo(() => {
    if (student) return fullName(student.user.firstName, student.user.lastName);
    if (teacher) return fullName(teacher.user.firstName, teacher.user.lastName);
    return "Profile";
  }, [student, teacher]);

  const photoUrl = student?.profileImageUrl ?? teacher?.profileImageUrl ?? null;

  return (
    <AdminModal wide title={loading ? "Profile" : name} onClose={onClose}>
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : error || (!student && !teacher) ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error || "Profile not found"}
        </p>
      ) : (
        <div className="flex flex-col gap-5 pt-1">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div className="flex items-center gap-3">
              <Avatar className="size-20">
                <AvatarImage src={photoUrl ?? undefined} alt={name} />
                <AvatarFallback className="bg-muted text-lg font-semibold text-muted-foreground">
                  {initials(
                    student?.user.firstName ?? teacher?.user.firstName ?? "",
                    student?.user.lastName ?? teacher?.user.lastName ?? "",
                  )}
                </AvatarFallback>
              </Avatar>
              {onEditProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 self-center"
                  onClick={onEditProfile}
                >
                  <IconPencil size={14} />
                  Edit profile
                </Button>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">{name}</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                <Badge variant="secondary">{kind === "student" ? "Student" : "Faculty"}</Badge>
                <AccountStatusBadge
                  status={student?.user.status ?? teacher?.user.status ?? ""}
                />
                {student && (
                  <Badge variant="outline">
                    {student.program ? `${student.program.code} · Sem ${student.currentSemester ?? "—"}` : "No program"}
                  </Badge>
                )}
                {teacher && <Badge variant="outline">{teacher.employeeNo}</Badge>}
              </div>
            </div>
          </div>
          {student ? <StudentModalTabs student={student} /> : null}
          {teacher ? <TeacherModalTabs teacher={teacher} /> : null}
          {dangerSection && (
            <div className="mt-1 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account management
              </p>
              {dangerSection}
            </div>
          )}
        </div>
      )}
    </AdminModal>
  );
}

function StudentModalTabs({ student }: { student: StudentDetail }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-3">
        <StudentOverview student={student} />
      </TabsContent>
      <TabsContent value="attendance" className="pt-3">
        <StudentAttendance student={student} />
      </TabsContent>
      <TabsContent value="results" className="pt-3">
        <StudentResults student={student} />
      </TabsContent>
    </Tabs>
  );
}

function TeacherModalTabs({ teacher }: { teacher: TeacherDetail }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="teaching">Subjects & Classes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-3">
        <TeacherOverview teacher={teacher} />
      </TabsContent>
      <TabsContent value="teaching" className="pt-3">
        <TeacherTeaching teacher={teacher} />
      </TabsContent>
    </Tabs>
  );
}

/** Present/absent chip shared by the student + teacher history views. */
export function AttendanceChip({ status }: { status: string }) {
  const present = status === "PRESENT";
  return (
    <span
      className={
        present
          ? "inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--ctp-green)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--ctp-green)]"
          : "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-semibold text-muted-foreground"
      }
    >
      {present ? "Present" : "Absent"}
    </span>
  );
}
