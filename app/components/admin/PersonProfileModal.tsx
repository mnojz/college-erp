"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  IconAlertTriangle,
  IconAward,
  IconBook2,
  IconCalendar,
  IconCalendarCheck,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconEdit,
  IconFilter,
  IconId,
  IconMail,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconSchool,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ImageUploadCrop } from "@/app/components/common/ImageUploadCrop";
import { SubjectAssigner, SubjectOption } from "@/app/components/admin/SubjectAssigner";
import { MarkRow } from "@/app/lib/grading";
import { cn } from "@/lib/utils";

function formatProfileDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fullName(first: string, last: string) {
  return `${first} ${last}`.trim() || "—";
}

function initials(first: string, last: string) {
  return `${first.charAt(0) ?? ""}${last.charAt(0) ?? ""}`.toUpperCase() || "–";
}

type AttendanceRecord = {
  id: string;
  status: "PRESENT" | "ABSENT" | string;
  note?: string | null;
  session: {
    sessionDate: string;
    class: {
      dayOfWeek: string;
      startTime?: string | null;
      endTime?: string | null;
      type: string | null;
      subject: { code: string; name: string };
    };
  };
};



type Marksheet = {
  id: string;
  title: string;
  type: string;
  semester: number;
  resultsPublishedAt: string;
  program: { name: string; code: string };
  rows: MarkRow[];
  gpa: number | null;
};

type StudentSemester = {
  id: string;
  semesterNo: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  academicYear: { id: string; name: string } | null;
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
  bloodGroup: string | null;
  phone: string | null;
  emergencyContact: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  currProvinceName: string | null;
  currDistrictName: string | null;
  currLocalLevelName: string | null;
  currWard: number | null;
  currTole: string | null;
  currSameAsPerm: boolean;
  permProvinceName: string | null;
  permDistrictName: string | null;
  permLocalLevelName: string | null;
  permWard: number | null;
  permTole: string | null;
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
  attendanceRecords: AttendanceRecord[];
  marksheets?: Marksheet[];
  examMarks?: Array<{
    id: string;
    marks: number | string;
    grade: string | null;
    examSubject: {
      id: string;
      maxMarks: number | string;
      subject: { code: string; name: string };
      session: { title: string; semester: number };
    };
  }>;
  studentSemesters?: StudentSemester[];
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
  subjectIds?: string[];
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
  _count: { announcements: number; classes: number };
};

type ProgramOption = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
};

interface PersonProfileModalProps {
  kind: "student" | "teacher";
  id: string;
  initialMode?: "view" | "edit";
  onClose: () => void;
  onSaved?: () => void;
  dangerSection?: React.ReactNode;
  programs?: ProgramOption[];
  allSubjects?: SubjectOption[];
}

export function PersonProfileModal({
  kind,
  id,
  initialMode = "view",
  onClose,
  onSaved,
  dangerSection,
  programs: initialPrograms,
  allSubjects: initialSubjects,
}: PersonProfileModalProps) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(initialMode === "edit");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [programsList, setProgramsList] = useState<ProgramOption[]>(initialPrograms ?? []);
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>(initialSubjects ?? []);

  // Student Edit Form State
  const [studentForm, setStudentForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    enrollmentNumber: "",
    registrationId: "",
    rollNumber: "",
    admissionDate: "",
    programId: "",
    currentSemester: "",
    gender: "",
    nationality: "",
    religion: "",
    category: "",
    bloodGroup: "",
    phone: "",
    emergencyContact: "",
    guardianRelation: "",
    guardianPhone: "",
    guardianEmail: "",
    status: "ACTIVE",
    userStatus: "ACTIVE",
    profileImageUrl: "",
  });

  // Teacher Edit Form State
  const [teacherForm, setTeacherForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    employeeNo: "",
    qualification: "",
    bio: "",
    office: "",
    phone: "",
    status: "ACTIVE",
    profileImageUrl: "",
    subjectIds: [] as string[],
  });

  // Load programs & subjects if not provided
  useEffect(() => {
    if (programsList.length === 0) {
      void fetch("/api/programs")
        .then((r) => r.json())
        .then((d) => setProgramsList(d.programs ?? []))
        .catch(() => {});
    }
    if (subjectsList.length === 0) {
      void fetch("/api/subjects")
        .then((r) => r.json())
        .then((d) => setSubjectsList(d.subjects ?? []))
        .catch(() => {});
    }
  }, [programsList.length, subjectsList.length]);

  // Load person profile
  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/person?kind=${kind}&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to load profile");
        return;
      }
      if (kind === "student") {
        const s: StudentDetail = data.student;
        setStudent(s);
        setStudentForm({
          firstName: s.user.firstName || "",
          lastName: s.user.lastName || "",
          email: s.user.email || "",
          password: "",
          enrollmentNumber: s.enrollmentNumber || "",
          registrationId: s.registrationId || "",
          rollNumber: s.rollNumber !== null ? String(s.rollNumber) : "",
          admissionDate: s.admissionDate ? s.admissionDate.split("T")[0] : "",
          programId: s.program?.id || "",
          currentSemester: s.currentSemester !== null ? String(s.currentSemester) : "",
          gender: s.gender || "",
          nationality: s.nationality || "",
          religion: s.religion || "",
          category: s.category || "",
          bloodGroup: s.bloodGroup || "",
          phone: s.phone || "",
          emergencyContact: s.emergencyContact || "",
          guardianRelation: s.guardianRelation || "",
          guardianPhone: s.guardianPhone || "",
          guardianEmail: s.guardianEmail || "",
          status: s.status || "ACTIVE",
          userStatus: s.user.status || "ACTIVE",
          profileImageUrl: s.profileImageUrl || "",
        });
      } else {
        const t: TeacherDetail = data.teacher;
        setTeacher(t);
        setTeacherForm({
          firstName: t.user.firstName || "",
          lastName: t.user.lastName || "",
          email: t.user.email || "",
          password: "",
          employeeNo: t.employeeNo || "",
          qualification: t.qualification || "",
          bio: t.bio || "",
          office: t.office || "",
          phone: t.phone || "",
          status: t.user.status || "ACTIVE",
          profileImageUrl: t.profileImageUrl || "",
          subjectIds: t.subjectIds || t.subjectTeachers.map((st) => st.subject.id),
        });
      }
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [kind, id]);

  const personName = useMemo(() => {
    if (student) return fullName(student.user.firstName, student.user.lastName);
    if (teacher) return fullName(teacher.user.firstName, teacher.user.lastName);
    return "Profile";
  }, [student, teacher]);

  const selectedStudentProgram = useMemo(() => {
    return programsList.find((p) => p.id === (isEditing ? studentForm.programId : student?.program?.id));
  }, [programsList, isEditing, studentForm.programId, student?.program?.id]);

  const studentMaxSemesters = selectedStudentProgram ? selectedStudentProgram.durationYears * 2 : 8;

  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      if (kind === "student") {
        if (!student) return;
        const payload: Record<string, unknown> = {
          id: student.id,
          firstName: studentForm.firstName,
          lastName: studentForm.lastName,
          email: studentForm.email,
          enrollmentNumber: studentForm.enrollmentNumber,
          registrationId: studentForm.registrationId,
          rollNumber: studentForm.rollNumber ? Number(studentForm.rollNumber) : undefined,
          admissionDate: studentForm.admissionDate,
          programId: studentForm.programId || undefined,
          currentSemester: studentForm.currentSemester ? Number(studentForm.currentSemester) : undefined,
          gender: studentForm.gender || undefined,
          nationality: studentForm.nationality || undefined,
          religion: studentForm.religion || undefined,
          category: studentForm.category || undefined,
          bloodGroup: studentForm.bloodGroup || undefined,
          phone: studentForm.phone || undefined,
          emergencyContact: studentForm.emergencyContact || undefined,
          guardianRelation: studentForm.guardianRelation || undefined,
          guardianPhone: studentForm.guardianPhone || undefined,
          guardianEmail: studentForm.guardianEmail || undefined,
          status: studentForm.status,
          userStatus: studentForm.userStatus,
          profileImageUrl: studentForm.profileImageUrl || undefined,
        };
        if (studentForm.password) {
          payload.password = studentForm.password;
        }

        const res = await fetch("/api/students", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveError(data.error ?? "Failed to update student profile");
          toast.error(data.error ?? "Failed to update student profile");
          return;
        }
        toast.success(`Student profile updated for ${studentForm.firstName} ${studentForm.lastName}`);
        setIsEditing(false);
        await loadProfile();
        onSaved?.();
      } else {
        if (!teacher) return;
        const payload: Record<string, unknown> = {
          id: teacher.id,
          firstName: teacherForm.firstName,
          lastName: teacherForm.lastName,
          email: teacherForm.email,
          employeeNo: teacherForm.employeeNo,
          qualification: teacherForm.qualification || undefined,
          bio: teacherForm.bio || undefined,
          office: teacherForm.office || undefined,
          phone: teacherForm.phone || undefined,
          profileImageUrl: teacherForm.profileImageUrl || undefined,
          subjectIds: teacherForm.subjectIds,
          status: teacherForm.status,
        };
        if (teacherForm.password) {
          payload.password = teacherForm.password;
        }

        const res = await fetch("/api/teachers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setSaveError(data.error ?? "Failed to update teacher profile");
          toast.error(data.error ?? "Failed to update teacher profile");
          return;
        }
        toast.success(`Teacher profile updated for ${teacherForm.firstName} ${teacherForm.lastName}`);
        setIsEditing(false);
        await loadProfile();
        onSaved?.();
      }
    } catch {
      setSaveError("An unexpected error occurred while saving.");
      toast.error("Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const currentPhoto = isEditing
    ? kind === "student"
      ? studentForm.profileImageUrl
      : teacherForm.profileImageUrl
    : student?.profileImageUrl ?? teacher?.profileImageUrl ?? null;

  return (
    <AdminModal
      wide
      title={
        loading
          ? "Loading Profile…"
          : isEditing
          ? `Edit ${kind === "student" ? "Student" : "Teacher"}: ${personName}`
          : `${personName}'s Profile`
      }
      onClose={onClose}
    >
      {loading ? (
        <div className="flex flex-col gap-5 pt-1">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-muted/40 p-4 sm:flex-row sm:p-5">
            <Skeleton className="size-16 rounded-full shrink-0 sm:size-20" />
            <div className="w-full min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="mx-auto h-6 w-44 sm:mx-0" />
              <Skeleton className="mx-auto h-4 w-60 sm:mx-0" />
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2 rounded-lg bg-card/60 p-3.5 border border-border/50">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ) : error || (!student && !teacher) ? (
        <p className="rounded-lg bg-destructive/15 px-4 py-3 text-sm font-medium text-destructive">
          {error || "Profile not found"}
        </p>
      ) : (
        <div className="flex flex-col gap-5 pt-1">
          {/* ── Top Hero Card ── */}
          <div className="relative rounded-xl bg-muted/30 p-4 sm:p-5 border border-border/60">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <Avatar className="size-16 shrink-0 sm:size-20">
                <AvatarImage src={currentPhoto ?? undefined} alt={personName} />
                <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
                  {initials(
                    student?.user.firstName ?? teacher?.user.firstName ?? "",
                    student?.user.lastName ?? teacher?.user.lastName ?? "",
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{personName}</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {student?.user.email ?? teacher?.user.email}
                    </p>
                  </div>

                  {/* Mode action toggle */}
                  <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() => {
                            setSaveError("");
                            setIsEditing(false);
                          }}
                          className="h-8 text-xs font-semibold"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving}
                          onClick={handleSave}
                          className="h-8 text-xs font-semibold gap-1.5"
                        >
                          <IconCheck size={14} />
                          {saving ? "Saving…" : "Save Changes"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSaveError("");
                          setIsEditing(true);
                        }}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        <IconPencil size={14} />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status Badges - strictly following GEMINI rule (border-0, solid text, semi-transparent bg) */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <Badge className="border-0 bg-primary/15 text-primary text-[11px] font-semibold">
                    {kind === "student" ? "Student" : "Teacher"}
                  </Badge>

                  {/* Account status */}
                  {(student?.user.status ?? teacher?.user.status) === "ACTIVE" ? (
                    <Badge className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                      Account Active
                    </Badge>
                  ) : (
                    <Badge className="border-0 bg-destructive/15 text-destructive text-[11px] font-semibold">
                      Account Inactive
                    </Badge>
                  )}

                  {/* Student enrollment status */}
                  {student && (
                    <Badge
                      className={cn(
                        "border-0 text-[11px] font-semibold",
                        student.status === "ACTIVE"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          : student.status === "GRADUATED"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {student.status}
                    </Badge>
                  )}

                  {/* Academic / Employee identifier badge */}
                  {student && student.program && (
                    <Badge className="border-0 bg-secondary/80 text-secondary-foreground text-[11px] font-medium font-mono">
                      {student.program.code} · Sem {student.currentSemester ?? "—"}
                    </Badge>
                  )}
                  {student && student.rollNumber !== null && (
                    <Badge className="border-0 bg-secondary/80 text-secondary-foreground text-[11px] font-medium font-mono">
                      Roll {student.rollNumber}
                    </Badge>
                  )}
                  {teacher && (
                    <Badge className="border-0 bg-secondary/80 text-secondary-foreground text-[11px] font-medium font-mono">
                      ID: {teacher.employeeNo}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* In Edit mode: Profile photo upload field */}
            {isEditing && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <ImageUploadCrop
                  label="Profile Photo (Crop to Square, Passport Size)"
                  value={
                    kind === "student"
                      ? studentForm.profileImageUrl
                      : teacherForm.profileImageUrl
                  }
                  onChange={(val) => {
                    if (kind === "student") {
                      setStudentForm((prev) => ({ ...prev, profileImageUrl: val }));
                    } else {
                      setTeacherForm((prev) => ({ ...prev, profileImageUrl: val }));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {saveError && (
            <p className="rounded-lg bg-destructive/15 px-3.5 py-2.5 text-xs font-semibold text-destructive">
              {saveError}
            </p>
          )}

          {/* ── Main Tabbed Sections ── */}
          {student ? (
            <StudentSections
              student={student}
              isEditing={isEditing}
              form={studentForm}
              setForm={setStudentForm}
              programs={programsList}
              selectedProgram={selectedStudentProgram}
              maxSemesters={studentMaxSemesters}
            />
          ) : teacher ? (
            <TeacherSections
              teacher={teacher}
              isEditing={isEditing}
              form={teacherForm}
              setForm={setTeacherForm}
              allSubjects={subjectsList}
            />
          ) : null}

          {/* ── Danger Section (Account Management) ── */}
          {dangerSection && !isEditing && (
            <div className="mt-2 border-t border-border/70 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Account Management & Safety
              </p>
              {dangerSection}
            </div>
          )}
        </div>
      )}
    </AdminModal>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * STUDENT SECTIONS (Overview, Attendance, Results, Enrolment)
 * ══════════════════════════════════════════════════════════════════ */
function StudentSections({
  student,
  isEditing,
  form,
  setForm,
  programs,
  selectedProgram,
  maxSemesters,
}: {
  student: StudentDetail;
  isEditing: boolean;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  programs: ProgramOption[];
  selectedProgram: ProgramOption | undefined;
  maxSemesters: number;
}) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4 h-9">
        <TabsTrigger value="overview" className="text-xs font-semibold">
          Overview
        </TabsTrigger>
        <TabsTrigger value="attendance" className="text-xs font-semibold">
          Attendance
        </TabsTrigger>
        <TabsTrigger value="results" className="text-xs font-semibold">
          Results
        </TabsTrigger>
        <TabsTrigger value="enrolment" className="text-xs font-semibold">
          Progression
        </TabsTrigger>
      </TabsList>

      {/* ── TAB 1: OVERVIEW & PROFILE INFO ── */}
      <TabsContent value="overview" className="pt-3 m-0 outline-hidden space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            {/* Basic Info */}
            <Card className="p-4 rounded-xl border border-border/70 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="st-first" className="text-xs">First Name *</Label>
                  <Input
                    id="st-first"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-last" className="text-xs">Last Name *</Label>
                  <Input
                    id="st-last"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-email" className="text-xs">Email Address *</Label>
                  <Input
                    id="st-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-pass" className="text-xs">Change Password (optional)</Label>
                  <Input
                    id="st-pass"
                    type="password"
                    placeholder="Leave blank to keep unchanged"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-phone" className="text-xs">Phone Number</Label>
                  <Input
                    id="st-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-gender" className="text-xs">Gender</Label>
                  <Select
                    value={form.gender || "UNSPECIFIED"}
                    onValueChange={(v) => setForm({ ...form, gender: v === "UNSPECIFIED" ? "" : v })}
                  >
                    <SelectTrigger id="st-gender" className="h-8.5 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-blood" className="text-xs">Blood Group</Label>
                  <Input
                    id="st-blood"
                    placeholder="e.g. O+, A+"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-category" className="text-xs">Category</Label>
                  <Input
                    id="st-category"
                    placeholder="e.g. Open, Reserved"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-nationality" className="text-xs">Nationality</Label>
                  <Input
                    id="st-nationality"
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-religion" className="text-xs">Religion</Label>
                  <Input
                    id="st-religion"
                    value={form.religion}
                    onChange={(e) => setForm({ ...form, religion: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
              </div>
            </Card>

            {/* Academic & Enrollment Info */}
            <Card className="p-4 rounded-xl border border-border/70 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Academic & Enrollment Details
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="st-enr" className="text-xs">Enrollment Number *</Label>
                  <Input
                    id="st-enr"
                    value={form.enrollmentNumber}
                    onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })}
                    className="h-8.5 text-xs font-mono"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-reg" className="text-xs">Registration ID *</Label>
                  <Input
                    id="st-reg"
                    value={form.registrationId}
                    onChange={(e) => setForm({ ...form, registrationId: e.target.value })}
                    className="h-8.5 text-xs font-mono"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-roll" className="text-xs">Class Roll Number</Label>
                  <Input
                    id="st-roll"
                    type="number"
                    value={form.rollNumber}
                    onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-adm" className="text-xs">Admission Date *</Label>
                  <Input
                    id="st-adm"
                    type="date"
                    value={form.admissionDate}
                    onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-prog" className="text-xs">Academic Program</Label>
                  <Select
                    value={form.programId || undefined}
                    onValueChange={(pid) => setForm({ ...form, programId: pid, currentSemester: "1" })}
                  >
                    <SelectTrigger id="st-prog" className="h-8.5 text-xs w-full">
                      <SelectValue placeholder="Select Program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-sem" className="text-xs">Current Semester</Label>
                  <Select
                    value={form.currentSemester || undefined}
                    onValueChange={(sem) => setForm({ ...form, currentSemester: sem })}
                    disabled={!form.programId}
                  >
                    <SelectTrigger id="st-sem" className="h-8.5 text-xs w-full">
                      <SelectValue placeholder={form.programId ? "Select semester" : "Pick program first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxSemesters }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Semester {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-status" className="text-xs">Enrollment Lifecycle</Label>
                  <Select
                    value={form.status}
                    onValueChange={(s) => setForm({ ...form, status: s })}
                  >
                    <SelectTrigger id="st-status" className="h-8.5 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                      <SelectItem value="GRADUATED">GRADUATED</SelectItem>
                      <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                      <SelectItem value="DROPPED">DROPPED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-ustatus" className="text-xs">Portal Sign-in Status</Label>
                  <Select
                    value={form.userStatus}
                    onValueChange={(s) => setForm({ ...form, userStatus: s })}
                  >
                    <SelectTrigger id="st-ustatus" className="h-8.5 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active (can log in)</SelectItem>
                      <SelectItem value="INACTIVE">Inactive (locked out)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Guardian & Contact */}
            <Card className="p-4 rounded-xl border border-border/70 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Guardian & Emergency Information
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="st-grel" className="text-xs">Guardian Relation / Name</Label>
                  <Input
                    id="st-grel"
                    placeholder="e.g. Father, Mother, Name"
                    value={form.guardianRelation}
                    onChange={(e) => setForm({ ...form, guardianRelation: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-gphone" className="text-xs">Guardian Phone</Label>
                  <Input
                    id="st-gphone"
                    value={form.guardianPhone}
                    onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-gemail" className="text-xs">Guardian Email</Label>
                  <Input
                    id="st-gemail"
                    type="email"
                    value={form.guardianEmail}
                    onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="st-econtact" className="text-xs">Emergency Contact</Label>
                  <Input
                    id="st-econtact"
                    value={form.emergencyContact}
                    onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Card 1: Academic & Enrollment */}
            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconSchool size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Academic & Enrollment
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem label="Program" value={student.program ? `${student.program.code} — ${student.program.name}` : "—"} />
                <InfoItem label="Current Semester" value={student.currentSemester ? `Semester ${student.currentSemester}` : "—"} />
                <InfoItem label="Roll Number" value={student.rollNumber ?? "—"} />
                <InfoItem label="Enrollment No." value={<span className="font-mono font-semibold">{student.enrollmentNumber}</span>} />
                <InfoItem label="Registration ID" value={<span className="font-mono font-semibold">{student.registrationId}</span>} />
                <InfoItem label="Admission Date" value={formatProfileDate(student.admissionDate)} />
                <InfoItem label="Enrolled Since" value={formatProfileDate(student.createdAt)} />
              </div>
            </Card>

            {/* Card 2: Personal Information */}
            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconUser size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Personal Details
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem label="Gender" value={student.gender ?? "—"} />
                <InfoItem label="Phone Number" value={student.phone ?? "—"} />
                <InfoItem label="Blood Group" value={student.bloodGroup ?? "—"} />
                <InfoItem label="Category" value={student.category ?? "—"} />
                <InfoItem label="Nationality" value={student.nationality ?? "—"} />
                <InfoItem label="Religion" value={student.religion ?? "—"} />
              </div>
            </Card>

            {/* Card 3: Guardian & Emergency Contacts */}
            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconPhone size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Guardian & Emergency
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem label="Guardian Relation / Name" value={student.guardianRelation ?? "—"} />
                <InfoItem label="Guardian Phone" value={student.guardianPhone ?? "—"} />
                <InfoItem label="Guardian Email" value={student.guardianEmail ?? "—"} />
                <InfoItem label="Emergency Contact" value={student.emergencyContact ?? "—"} />
              </div>
            </Card>

            {/* Card 4: Address Details */}
            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconMapPin size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Address Details
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem
                  label="Current Address"
                  value={
                    [student.currTole, student.currWard ? `Ward ${student.currWard}` : "", student.currLocalLevelName, student.currDistrictName, student.currProvinceName]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
                <InfoItem
                  label="Permanent Address"
                  value={
                    student.currSameAsPerm
                      ? "Same as current address"
                      : [student.permTole, student.permWard ? `Ward ${student.permWard}` : "", student.permLocalLevelName, student.permDistrictName, student.permProvinceName]
                          .filter(Boolean)
                          .join(", ") || "—"
                  }
                />
              </div>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* ── TAB 2: ATTENDANCE LOGS (Reusing /student/attendance Layout) ── */}
      <TabsContent value="attendance" className="pt-3 m-0 outline-hidden space-y-4">
        <StudentAttendanceView student={student} />
      </TabsContent>

      {/* ── TAB 3: EXAM RESULTS & MARKSHEETS (Reusing /student/results Layout) ── */}
      <TabsContent value="results" className="pt-3 m-0 outline-hidden space-y-4">
        <StudentResultsView student={student} />
      </TabsContent>

      {/* ── TAB 4: ENROLMENT & SEMESTER PROGRESSION ── */}
      <TabsContent value="enrolment" className="pt-3 m-0 outline-hidden space-y-4">
        <StudentEnrolmentView student={student} />
      </TabsContent>
    </Tabs>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * STUDENT ATTENDANCE VIEW (Reuses /student/attendance layout)
 * ══════════════════════════════════════════════════════════════════ */
function StudentAttendanceView({ student }: { student: StudentDetail }) {
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const records = student.attendanceRecords || [];
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const overallPct = total > 0 ? (present / total) * 100 : 0;
  const isQualified = overallPct >= 75;

  // Subjects extracted from records
  const subjects = useMemo(() => {
    const map = new Map<string, { code: string; name: string; present: number; total: number }>();
    for (const r of records) {
      const code = r.session.class.subject.code;
      const name = r.session.class.subject.name;
      if (!map.has(code)) {
        map.set(code, { code, name, present: 0, total: 0 });
      }
      const entry = map.get(code)!;
      entry.total += 1;
      if (r.status === "PRESENT") entry.present += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [records]);

  // Filtered timeline records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedSubject !== "ALL" && r.session.class.subject.code !== selectedSubject) {
        return false;
      }
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = r.session.class.subject.code.toLowerCase();
        const name = r.session.class.subject.name.toLowerCase();
        const date = r.session.sessionDate.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !date.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedSubject, statusFilter, searchQuery]);

  // Group filtered records by date
  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        dateKey: string;
        displayDate: string;
        weekday: string;
        records: AttendanceRecord[];
        presentCount: number;
        absentCount: number;
      }
    >();

    for (const record of filteredRecords) {
      const rawDate = record.session.sessionDate;
      const key = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate.slice(0, 10);

      if (!map.has(key)) {
        const [year, month, day] = key.split("-").map(Number);
        const dateObj = new Date(year, (month || 1) - 1, day || 1);
        const displayDate = dateObj.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const weekday =
          record.session.class.dayOfWeek ||
          dateObj.toLocaleDateString("en-US", { weekday: "long" });

        map.set(key, {
          dateKey: key,
          displayDate,
          weekday,
          records: [],
          presentCount: 0,
          absentCount: 0,
        });
      }

      const dayGroup = map.get(key)!;
      dayGroup.records.push(record);
      if (record.status === "PRESENT") dayGroup.presentCount += 1;
      else dayGroup.absentCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredRecords]);

  function toggleDateExpanded(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Metric Stat Cards Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Stat 1: Overall Percentage & Eligibility */}
        <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Attendance Rate</span>
            {isQualified ? (
              <IconCircleCheck size={16} className="text-emerald-500" />
            ) : (
              <IconAlertTriangle size={16} className="text-amber-500" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {total > 0 ? `${overallPct.toFixed(1)}%` : "—"}
            </span>
            <Badge
              className={cn(
                "border-0 text-[10px] font-bold py-0.5",
                isQualified
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              {isQualified ? "Qualified" : "Low"}
            </Badge>
          </div>
        </Card>

        {/* Stat 2: Total Classes */}
        <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Classes</span>
            <IconCalendar size={16} className="text-primary" />
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {total}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">recorded</span>
          </div>
        </Card>

        {/* Stat 3: Present */}
        <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Attended</span>
            <IconCircleCheck size={16} className="text-emerald-500" />
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {present}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">sessions</span>
          </div>
        </Card>

        {/* Stat 4: Absent */}
        <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Missed</span>
            <IconCircleX size={16} className="text-destructive" />
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-destructive">
              {absent}
            </span>
            <span className="ml-1 text-[11px] text-muted-foreground">sessions</span>
          </div>
        </Card>
      </div>

      {/* ── Section 1: Subject-wise Summary Table ── */}
      {subjects.length > 0 && (
        <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
          <div className="p-3 bg-muted/30 border-b border-border/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Subject-wise Attendance Breakdown
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase py-2">Subject</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center py-2 w-28">Classes</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-2 w-52">Attendance Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((sub) => {
                  const pct = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                  const isGood = pct >= 75;
                  return (
                    <TableRow key={sub.code} className="hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge className="font-mono text-xs font-bold bg-primary/15 text-primary border-0 shrink-0">
                            {sub.code}
                          </Badge>
                          <span className="text-xs font-semibold text-foreground truncate" title={sub.name}>
                            {sub.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <span className="text-xs font-medium tabular-nums">
                          <strong className="text-foreground">{sub.present}</strong>
                          <span className="text-muted-foreground"> / {sub.total}</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={cn(
                                "font-bold tabular-nums",
                                sub.total === 0
                                  ? "text-muted-foreground"
                                  : isGood
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {sub.total > 0 ? `${pct.toFixed(1)}%` : "—"}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                sub.total === 0
                                  ? "bg-muted"
                                  : isGood
                                  ? "bg-emerald-500"
                                  : pct >= 60
                                  ? "bg-amber-500"
                                  : "bg-destructive",
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Section 2: Daily Attendance Logs ── */}
      <div className="space-y-3">
        {/* Filter Toolbar */}
        <Card className="p-3 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-40">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search subject or date…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Subjects</SelectItem>
                  {subjects.map((sub) => (
                    <SelectItem key={sub.code} value={sub.code}>
                      {sub.code} — {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status pill toggles */}
              <div className="inline-flex rounded-lg bg-muted/50 p-0.5 shrink-0">
                {(["ALL", "PRESENT", "ABSENT"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded-md transition-colors",
                      statusFilter === st
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {st === "ALL" ? "All" : st === "PRESENT" ? "Present" : "Absent"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Date Grouped Cards */}
        {groupedByDate.length === 0 ? (
          <Card className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-card/60">
            <IconCalendarCheck className="size-8 text-muted-foreground/50 mx-auto" />
            <p className="mt-2 text-xs font-semibold text-foreground">No attendance records found</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              No matching records for the selected filters.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {groupedByDate.map((group) => {
              const allPresent = group.absentCount === 0;
              const allAbsent = group.presentCount === 0;
              const isExpanded = expandedDates.has(group.dateKey);

              return (
                <Card
                  key={group.dateKey}
                  className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card"
                >
                  <button
                    type="button"
                    onClick={() => toggleDateExpanded(group.dateKey)}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer",
                      isExpanded && "border-b border-border/60",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconCalendar size={14} className="text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground">
                        {group.displayDate}
                      </span>
                      <Badge className="text-[10px] font-semibold uppercase px-1.5 py-0 border-0 bg-primary/15 text-primary shrink-0">
                        {group.weekday}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        ({group.records.length} {group.records.length === 1 ? "session" : "sessions"})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {allPresent ? (
                        <Badge className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold gap-1 py-0.5">
                          <IconCircleCheck size={11} className="text-emerald-500" />
                          All Present ({group.presentCount}/{group.records.length})
                        </Badge>
                      ) : allAbsent ? (
                        <Badge className="border-0 bg-destructive/15 text-destructive text-[10px] font-bold gap-1 py-0.5">
                          <IconCircleX size={11} className="text-destructive" />
                          All Absent ({group.absentCount})
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {group.presentCount} Present
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-destructive">
                            {group.absentCount} Absent
                          </span>
                        </div>
                      )}

                      <IconChevronDown
                        size={15}
                        className={cn(
                          "text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180 text-foreground",
                        )}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-border/60 bg-card">
                      {group.records.map((r) => {
                        const isPresent = r.status === "PRESENT";
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-muted/20"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge className="font-mono text-[11px] font-bold bg-primary/15 text-primary border-0 shrink-0">
                                {r.session.class.subject.code}
                              </Badge>
                              <span className="font-medium text-foreground truncate">
                                {r.session.class.subject.name}
                              </span>
                              {r.session.class.type && (
                                <Badge className="text-[10px] bg-secondary/80 text-secondary-foreground border-0 font-normal">
                                  {r.session.class.type}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {r.session.class.startTime && (
                                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                  {new Date(r.session.class.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <Badge
                                className={cn(
                                  "border-0 text-[10px] font-semibold py-0.5",
                                  isPresent
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "bg-destructive/15 text-destructive",
                                )}
                              >
                                {isPresent ? "Present" : "Absent"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * STUDENT RESULTS VIEW (Reuses /student/results Marksheet Layout)
 * ══════════════════════════════════════════════════════════════════ */
function StudentResultsView({ student }: { student: StudentDetail }) {
  const marksheets = student.marksheets || [];

  if (marksheets.length === 0 && (!student.examMarks || student.examMarks.length === 0)) {
    return (
      <Card className="rounded-xl border border-dashed border-border/80 p-10 text-center bg-card/60">
        <IconAward className="size-8 text-muted-foreground/50 mx-auto" />
        <h4 className="mt-2 text-xs font-semibold text-foreground">No Published Exam Results</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Results will appear here once exam sessions are published by admin.
        </p>
      </Card>
    );
  }

  // If structured marksheets exist, render each marksheet card
  if (marksheets.length > 0) {
    return (
      <div className="space-y-4">
        {marksheets.map((sheet) => {
          const rows = sheet.rows || [];
          const totalCredits = rows.reduce((sum, r) => sum + (r.credits || 0), 0);
          const earnedCredits = rows.filter((r) => r.passed).reduce((sum, r) => sum + (r.credits || 0), 0);
          const totalGradePoints = rows.filter((r) => r.passed).reduce((sum, r) => sum + (r.gradePoint || 0), 0);
          const gpa = sheet.gpa ?? (earnedCredits > 0 ? totalGradePoints / earnedCredits : 0);
          const allPassed = rows.length > 0 && rows.every((r) => r.passed);

          return (
            <Card key={sheet.id} className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
              {/* Marksheet Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-muted/30 border-b border-border/60">
                <div>
                  <h4 className="text-sm font-bold tracking-tight text-foreground">{sheet.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sheet.program?.name} · Semester {sheet.semester} · {sheet.type?.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Badge
                    className={cn(
                      "border-0 text-xs font-bold px-2 py-0.5",
                      allPassed
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {allPassed ? "PASSED" : "FAILED / BACKLOG"}
                  </Badge>
                  <div className="text-right pl-2 border-l border-border/60">
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {gpa > 0 ? gpa.toFixed(2) : "—"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">GPA</span>
                  </div>
                </div>
              </div>

              {/* Two-Tier Marksheet Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="border-b-0">
                      <TableHead rowSpan={2} className="w-20 align-middle text-center text-[11px] font-bold uppercase">
                        Code
                      </TableHead>
                      <TableHead rowSpan={2} className="min-w-44 align-middle text-[11px] font-bold uppercase">
                        Course Title
                      </TableHead>
                      <TableHead rowSpan={2} className="w-16 text-center align-middle text-[11px] font-bold uppercase">
                        Credits
                      </TableHead>
                      <TableHead colSpan={2} className="text-center text-[11px] font-bold uppercase pb-1 border-b border-border/60">
                        Obtained Grade
                      </TableHead>
                      <TableHead rowSpan={2} className="w-20 text-center align-middle text-[11px] font-bold uppercase">
                        Final Grade
                      </TableHead>
                      <TableHead rowSpan={2} className="w-20 text-center align-middle text-[11px] font-bold uppercase">
                        Grade Value
                      </TableHead>
                      <TableHead rowSpan={2} className="w-20 text-center align-middle text-[11px] font-bold uppercase">
                        Grade Point
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="w-14 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 pt-0 pb-1.5">
                        TH
                      </TableHead>
                      <TableHead className="w-14 text-center text-[10px] font-bold text-purple-600 dark:text-purple-400 pt-0 pb-1.5">
                        PR
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className="hover:bg-muted/20 text-xs">
                        <TableCell className="font-mono font-bold text-center py-2.5">
                          {r.subjectCode}
                        </TableCell>
                        <TableCell className="font-medium py-2.5">
                          {r.subjectName}
                        </TableCell>
                        <TableCell className="text-center tabular-nums py-2.5">
                          {r.credits}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold py-2.5 text-blue-600 dark:text-blue-400">
                          {r.thGrade ?? "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold py-2.5 text-purple-600 dark:text-purple-400">
                          {r.prGrade ?? "—"}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge
                            className={cn(
                              "border-0 text-[10px] font-bold px-2 py-0.5",
                              r.passed
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-destructive/15 text-destructive",
                            )}
                          >
                            {r.finalGrade || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums py-2.5">
                          {r.gradeValue > 0 ? r.gradeValue.toFixed(2) : "0.00"}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold py-2.5">
                          {r.gradePoint > 0 ? r.gradePoint.toFixed(2) : "0.00"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Marksheet Footer Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-t border-border/60 text-xs">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Total Credits: <strong className="text-foreground">{totalCredits}</strong></span>
                  <span>Earned Credits: <strong className="text-foreground">{earnedCredits}</strong></span>
                  <span>Total Points: <strong className="text-foreground">{totalGradePoints.toFixed(2)}</strong></span>
                </div>
                <div className="font-bold text-foreground">
                  Semester GPA: <span className="text-primary text-sm">{gpa > 0 ? gpa.toFixed(2) : "—"}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Fallback if only examMarks exists
  return (
    <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
      <div className="p-3 bg-muted/30 border-b border-border/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Published Examination Marks
        </h4>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase">Exam Session</TableHead>
              <TableHead className="text-xs font-bold uppercase">Subject</TableHead>
              <TableHead className="text-xs font-bold uppercase text-center">Marks</TableHead>
              <TableHead className="text-xs font-bold uppercase text-center">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(student.examMarks || []).map((r) => (
              <TableRow key={r.id} className="text-xs">
                <TableCell>
                  <strong>{r.examSubject.session.title}</strong>
                  <div className="text-[11px] text-muted-foreground">
                    Sem {r.examSubject.session.semester}
                  </div>
                </TableCell>
                <TableCell>
                  <strong className="font-mono">{r.examSubject.subject.code}</strong>
                  <div className="text-[11px] text-muted-foreground">
                    {r.examSubject.subject.name}
                  </div>
                </TableCell>
                <TableCell className="text-center font-semibold tabular-nums">
                  {Number(r.marks)} / {Number(r.examSubject.maxMarks)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    className={cn(
                      "border-0 text-[10px] font-bold px-2 py-0.5",
                      Number(r.marks) >= Number(r.examSubject.maxMarks) * 0.4
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {r.grade ?? "—"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * STUDENT ENROLMENT & PROGRESSION
 * ══════════════════════════════════════════════════════════════════ */
function StudentEnrolmentView({ student }: { student: StudentDetail }) {
  const semesters = student.studentSemesters || [];

  if (semesters.length === 0) {
    return (
      <Card className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-card/60">
        <IconSchool className="size-8 text-muted-foreground/50 mx-auto" />
        <h4 className="mt-2 text-xs font-semibold text-foreground">No Semester Progression History</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Student is currently enrolled in Semester {student.currentSemester ?? "1"}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
      <div className="p-3 bg-muted/30 border-b border-border/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Semester Progression History
        </h4>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="text-xs font-bold uppercase">Semester</TableHead>
              <TableHead className="text-xs font-bold uppercase">Academic Year</TableHead>
              <TableHead className="text-xs font-bold uppercase">Duration</TableHead>
              <TableHead className="text-xs font-bold uppercase text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesters.map((s) => (
              <TableRow key={s.id} className="text-xs">
                <TableCell className="font-semibold">
                  Semester {s.semesterNo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.academicYear?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatProfileDate(s.startDate)} – {formatProfileDate(s.endDate)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    className={cn(
                      "border-0 text-[10px] font-bold px-2 py-0.5",
                      s.status === "COMPLETED"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : s.status === "ACTIVE"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary/80 text-secondary-foreground",
                    )}
                  >
                    {s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * TEACHER SECTIONS (Overview, Subjects & Classes)
 * ══════════════════════════════════════════════════════════════════ */
function TeacherSections({
  teacher,
  isEditing,
  form,
  setForm,
  allSubjects,
}: {
  teacher: TeacherDetail;
  isEditing: boolean;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  allSubjects: SubjectOption[];
}) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-9">
        <TabsTrigger value="overview" className="text-xs font-semibold">
          Overview & Bio
        </TabsTrigger>
        <TabsTrigger value="teaching" className="text-xs font-semibold">
          Assigned Subjects & Timetable
        </TabsTrigger>
      </TabsList>

      {/* ── TAB 1: TEACHER OVERVIEW ── */}
      <TabsContent value="overview" className="pt-3 m-0 outline-hidden space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <Card className="p-4 rounded-xl border border-border/70 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Personal & Faculty Information
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="tc-first" className="text-xs">First Name *</Label>
                  <Input
                    id="tc-first"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-last" className="text-xs">Last Name *</Label>
                  <Input
                    id="tc-last"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-emp" className="text-xs">Employee ID Number *</Label>
                  <Input
                    id="tc-emp"
                    value={form.employeeNo}
                    onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                    className="h-8.5 text-xs font-mono"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-email" className="text-xs">Email Address *</Label>
                  <Input
                    id="tc-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-8.5 text-xs"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-pass" className="text-xs">Change Password (optional)</Label>
                  <Input
                    id="tc-pass"
                    type="password"
                    placeholder="Leave blank to keep unchanged"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-status" className="text-xs">Account Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(s) => setForm({ ...form, status: s })}
                  >
                    <SelectTrigger id="tc-status" className="h-8.5 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active (can log in)</SelectItem>
                      <SelectItem value="INACTIVE">Inactive (blocked)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-phone" className="text-xs">Phone Number</Label>
                  <Input
                    id="tc-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="tc-office" className="text-xs">Office / Room</Label>
                  <Input
                    id="tc-office"
                    placeholder="e.g. Block A, Room 302"
                    value={form.office}
                    onChange={(e) => setForm({ ...form, office: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="tc-qual" className="text-xs">Qualification</Label>
                  <Input
                    id="tc-qual"
                    placeholder="e.g. M.Sc. Computer Science, Ph.D."
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="tc-bio" className="text-xs">About / Bio</Label>
                  <Input
                    id="tc-bio"
                    placeholder="Brief teacher introduction or research interests…"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    className="h-8.5 text-xs"
                  />
                </div>
              </div>
            </Card>

            {/* Subject Assigner in Edit Mode */}
            <Card className="p-4 rounded-xl border border-border/70 space-y-3">
              <SubjectAssigner
                subjects={allSubjects}
                assignedIds={form.subjectIds}
                onChange={(next) => setForm({ ...form, subjectIds: next })}
              />
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconUser size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Faculty & Contact Details
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem label="Employee ID" value={<span className="font-mono font-semibold">{teacher.employeeNo}</span>} />
                <InfoItem label="Email" value={teacher.user.email} />
                <InfoItem label="Phone" value={teacher.phone ?? "—"} />
                <InfoItem label="Office / Room" value={teacher.office ?? "—"} />
                <InfoItem label="Qualification" value={teacher.qualification ?? "—"} />
                <InfoItem label="Faculty Since" value={formatProfileDate(teacher.createdAt)} />
              </div>
            </Card>

            <Card className="p-4 rounded-xl border border-border/70 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <IconBook2 size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Academic Responsibilities
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <InfoItem label="Assigned Subjects" value={`${teacher.subjectTeachers.length} courses`} />
                <InfoItem label="Weekly Scheduled Classes" value={`${teacher.classes.length} periods`} />
                <InfoItem label="Announcements Authored" value={teacher._count.announcements} />
                <InfoItem label="About / Bio" value={teacher.bio ?? "—"} />
              </div>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* ── TAB 2: SUBJECTS & TIMETABLE ── */}
      <TabsContent value="teaching" className="pt-3 m-0 outline-hidden space-y-4">
        {teacher.subjectTeachers.length === 0 && teacher.classes.length === 0 ? (
          <Card className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-card/60">
            <IconBook2 className="size-8 text-muted-foreground/50 mx-auto" />
            <h4 className="mt-2 text-xs font-semibold text-foreground">No Subjects Assigned</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Click “Edit Profile” to assign subjects and schedule classes for this teacher.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Assigned Subjects Table */}
            {teacher.subjectTeachers.length > 0 && (
              <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
                <div className="p-3 bg-muted/30 border-b border-border/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned Courses ({teacher.subjectTeachers.length})
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase">Subject Code</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Subject Name</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-right">Program · Semester</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacher.subjectTeachers.map((st) => (
                        <TableRow key={st.id} className="text-xs hover:bg-muted/20">
                          <TableCell className="font-mono font-bold text-primary py-2.5">
                            {st.subject.code}
                          </TableCell>
                          <TableCell className="font-medium py-2.5">
                            {st.subject.name}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <Badge className="border-0 bg-primary/15 text-primary text-[10px] font-semibold">
                              {st.subject.program?.code ?? "—"} · Sem {st.subject.semester}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {/* Weekly Schedule Table */}
            {teacher.classes.length > 0 && (
              <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
                <div className="p-3 bg-muted/30 border-b border-border/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Weekly Teaching Timetable ({teacher.classes.length} classes)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase">Day</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Time</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Subject</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Class Type</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-right">Program · Sem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacher.classes.map((c) => (
                        <TableRow key={c.id} className="text-xs hover:bg-muted/20">
                          <TableCell className="font-bold capitalize py-2.5">
                            {c.dayOfWeek.toLowerCase()}
                          </TableCell>
                          <TableCell className="text-muted-foreground py-2.5 whitespace-nowrap">
                            {new Date(c.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {new Date(c.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <strong className="font-mono">{c.subject.code}</strong>
                            <span className="text-muted-foreground ml-1.5">{c.subject.name}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {c.type ? (
                              <Badge className="border-0 bg-secondary/80 text-secondary-foreground text-[10px] font-normal">
                                {c.type}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <span className="font-semibold text-foreground">
                              {c.program.code} · Sem {c.semester}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

/** Reusable label-value row component */
function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground font-medium text-[11px] uppercase tracking-wider">{label}</span>
      <span className="font-semibold text-foreground break-words text-left sm:text-right">{value}</span>
    </div>
  );
}
