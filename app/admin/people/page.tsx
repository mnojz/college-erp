"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconUserOff,
  IconX,
} from "@tabler/icons-react";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import {
  PaginationControls,
  type PaginationMeta,
} from "@/app/components/common/PaginationControls";
import { ImageUploadCrop } from "@/app/components/common/ImageUploadCrop";
import { cn } from "cn";

type TeacherItem = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  subjectTeachers: Array<{
    id: string;
    subject: { id: string; code: string; name: string; semester: number };
  }>;
};

type StudentItem = {
  id: string;
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  admissionDate: string;
  programId: string | null;
  currentSemester: number | null;
  gender: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  // Enrollment lifecycle (ACTIVE / INACTIVE / GRADUATED / SUSPENDED / WITHDRAWN).
  status: string;
  program: { id: string; name: string; code: string } | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
};

type ProgramOption = { id: string; name: string; code: string; durationYears: number };
type SubjectOption = {
  id: string;
  code: string;
  name: string;
  semester: number;
  programId: string;
  program: { name: string; code: string } | null;
};

type DeleteTarget = {
  type: "teacher" | "student";
  id: string;
  name: string;
  identifier: string;
};

/** Row picked for the deactivate confirmation modal (activation needs no modal). */
type StatusTarget = {
  kind: "teacher" | "student";
  userId: string;
  name: string;
  identifier: string;
};

const teacherEmpty = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  employeeNo: "",
  profileImageUrl: "",
  subjectIds: [] as string[],
  status: "ACTIVE",
};

const studentEmpty = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  enrollmentNumber: "",
  registrationId: "",
  rollNumber: "",
  admissionDate: new Date().toISOString().slice(0, 10),
  programId: "",
  currentSemester: "1",
  profileImageUrl: "",
  // Enrollment lifecycle (badge on the student's profile hero).
  status: "ACTIVE",
  // Portal access (User.status) — whether the account can sign in.
  userStatus: "ACTIVE",
  // Critical personal information — admin-entered only.
  gender: "",
  nationality: "",
  religion: "",
  category: "",
};

/** Dark-mode-safe initials for the shadcn Avatar fallback. */
function initialsOf(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

/** "ACTIVE" → "Active" — plain labels for the neutral status badges. */
function titleCaseStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Options for the students Status filter.
 *
 * This is deliberately the binary account state (UserStatus: ACTIVE /
 * INACTIVE — i.e. can this student sign in?), not the 5-value StudentStatus
 * enrollment lifecycle. The lifecycle (Graduated / Suspended / Withdrawn)
 * still renders as a badge in the table, so excluding it from the filter
 * never hides a student — every student matches Active or Inactive.
 */
const ACCOUNT_STATUS_OPTIONS = ["ACTIVE", "INACTIVE"] as const;

/** Neutral account-status badge (replaces the old unstyled .badge classes). */
function AccountStatusBadge({ status }: { status: string }) {
  return status === "ACTIVE" ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline">Inactive</Badge>
  );
}

/**
 * Subject-assignment picker for the faculty create/edit modals.
 *
 * Shows only the subjects already assigned to the teacher as removable chips,
 * plus a dedicated "Assign Subject" button. Clicking it expands a searchable
 * catalog of ALL subjects — assigned ones appear disabled ("Assigned"),
 * unassigned ones are added on click. The parent's assignedIds drives both
 * lists, so assigning/removing instantly updates the chips.
 */
function SubjectAssigner({
  subjects,
  assignedIds,
  onChange,
}: {
  subjects: SubjectOption[];
  assignedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");

  const assigned = subjects.filter((s) => assignedIds.includes(s.id));
  const q = query.trim().toLowerCase();
  const visible = subjects.filter((s) => {
    if (programFilter !== "ALL" && (s.program?.code ?? "") !== programFilter) return false;
    if (semesterFilter !== "ALL" && String(s.semester) !== semesterFilter) return false;
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.program?.code ?? "").toLowerCase().includes(q) ||
      (s.program?.name ?? "").toLowerCase().includes(q)
    );
  });

  // Distinct semesters present across the catalog (for the filter dropdown).
  const semesters = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.semester))).sort((a, b) => a - b),
    [subjects],
  );

  // Distinct programs present across the catalog (for the filter dropdown).
  const programs = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();
    for (const s of subjects) {
      if (s.program && !byCode.has(s.program.code)) {
        byCode.set(s.program.code, s.program);
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects]);

  const filtersActive = programFilter !== "ALL" || semesterFilter !== "ALL";
  const activeFilterLabel = [
    programFilter !== "ALL" ? `program ${programFilter}` : "",
    semesterFilter !== "ALL" ? `semester ${semesterFilter}` : "",
    q ? `“${query.trim()}”` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>Assigned subjects</Label>
        <span className="text-xs text-muted-foreground">
          Drives automatic class scheduling
        </span>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No subjects assigned yet. Click “Assign Subject” below to add one.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((s) => (
            <Badge key={s.id} variant="secondary" className="h-auto gap-1.5 py-1 pr-1 font-normal">
              <span className="font-semibold">{s.code}</span>
              <span className="text-muted-foreground">{s.name}</span>
              <span className="text-muted-foreground/70">
                · Sem {s.semester}
                {s.program ? ` · ${s.program.code}` : ""}
              </span>
              <button
                type="button"
                title={`Remove ${s.code} from this teacher`}
                aria-label={`Remove ${s.code}`}
                onClick={() => onChange(assignedIds.filter((id) => id !== s.id))}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-foreground/10"
              >
                <IconX size={12} aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant={pickerOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {pickerOpen ? (
            "Done"
          ) : (
            <>
              <IconPlus size={15} aria-hidden="true" />
              Assign Subject
            </>
          )}
        </Button>
        {assigned.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {assigned.length} of {subjects.length} assigned
          </span>
        )}
      </div>

      {pickerOpen && (
        <div className="grid gap-2.5 rounded-lg border bg-card p-3">
          {/* Full-width search */}
          <div className="relative">
            <IconSearch
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 z-[1] -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search by code, name, or program…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Program + semester filters */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Program</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Semester</Label>
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All semesters</SelectItem>
                  {semesters.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProgramFilter("ALL");
                  setSemesterFilter("ALL");
                }}
                title="Clear filters"
                className="self-end"
              >
                <IconX size={13} aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>

          {/* Catalog list */}
          <div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Subjects
              </span>
              <span className="text-[11px] text-muted-foreground">
                {visible.length} of {subjects.length}
              </span>
            </div>
            <div className="grid max-h-56 gap-0.5 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-muted-foreground">
                  {subjects.length === 0
                    ? "No subjects yet — publish a curriculum first."
                    : `No subjects match: ${activeFilterLabel || "current filters"}.`}
                </p>
              ) : (
                visible.map((s) => {
                  const isAssigned = assignedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isAssigned}
                      onClick={() => onChange([...assignedIds, s.id])}
                      title={isAssigned ? "Already assigned" : `Assign ${s.code} · ${s.name}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                        isAssigned ? "cursor-default opacity-55" : "hover:bg-accent",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{s.code}</span> · {s.name}
                        <span className="text-muted-foreground">
                          {" "}
                          — {s.program?.code ?? ""} · Sem {s.semester}
                        </span>
                      </span>
                      {isAssigned ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-muted-foreground">
                          <IconCircleCheck size={15} aria-hidden="true" />
                          Assigned
                        </span>
                      ) : (
                        <IconPlus
                          size={15}
                          className="shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPeoplePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"teachers" | "students">("teachers");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  // Teachers: free-text search only.
  const [searchQuery, setSearchQuery] = useState("");
  // Students: program + semester + status + free-text search.
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("ALL");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [studentSearch, setStudentSearch] = useState("");
  /** Debounced copy of studentSearch so typing doesn't fire a request per key. */
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");
  // Students are fetched paginated + filtered server-side (see loadStudents).
  const [studentPage, setStudentPage] = useState(1);
  const [studentPagination, setStudentPagination] = useState<PaginationMeta>({
    total: 0, page: 1, pageSize: 25, totalPages: 1, hasMore: false,
  });
  const [studentsBusy, setStudentsBusy] = useState(false);

  // Create Modals
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState(teacherEmpty);
  const [studentForm, setStudentForm] = useState(studentEmpty);

  // Edit Modals
  const [editingTeacher, setEditingTeacher] = useState<{ id: string } & typeof teacherEmpty | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: string } & typeof studentEmpty | null>(null);

  // Delete Confirmation Modal
  const [deletingTarget, setDeletingTarget] = useState<DeleteTarget | null>(null);

  // Deactivate Confirmation Modal (activation is applied directly, no modal)
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /**
   * Fetch one page of students with every filter applied in the DATABASE.
   * This is what makes pagination correct — filtering the current page in the
   * browser can only ever match rows that happen to already be loaded, so a
   * search would silently miss most matches.
   */
  async function loadStudents(page: number) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "25");
    if (debouncedStudentSearch.trim()) params.set("q", debouncedStudentSearch.trim());
    if (selectedProgramFilter !== "ALL") params.set("programId", selectedProgramFilter);
    if (selectedSemesterFilter !== "ALL") params.set("semester", selectedSemesterFilter);
    if (selectedStatusFilter !== "ALL") params.set("status", selectedStatusFilter);

    setStudentsBusy(true);
    try {
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to load students");
        return;
      }
      setStudents(data.students ?? []);
      if (data.pagination) setStudentPagination(data.pagination);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setStudentsBusy(false);
    }
  }

  // Debounce the search box so a request isn't fired on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedStudentSearch(studentSearch), 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  // Any filter change restarts at page 1 — otherwise you land on page 7 of a
  // narrower result set and see an empty table.
  useEffect(() => {
    const sync = setTimeout(() => void loadStudents(1), 0);
    return () => clearTimeout(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on filter change only
  }, [debouncedStudentSearch, selectedProgramFilter, selectedSemesterFilter, selectedStatusFilter]);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        const [tRes, pRes, subRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/programs"),
          fetch("/api/subjects"),
        ]);
        const [td, pd, subd] = await Promise.all([tRes.json(), pRes.json(), subRes.json()]);
        setTeachers(td.teachers ?? []);
        setPrograms(pd.programs ?? []);
        setSubjects(subd.subjects ?? []);
      } catch {
        setError("Unable to load directories");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Derived semester count for student creation form
  const createStudentProgram = useMemo(
    () => programs.find((p) => p.id === studentForm.programId),
    [programs, studentForm.programId],
  );
  const createStudentSemestersCount = createStudentProgram ? createStudentProgram.durationYears * 2 : 0;

  // Derived semester count for student edit form
  const editStudentProgram = useMemo(
    () => programs.find((p) => p.id === editingStudent?.programId),
    [programs, editingStudent?.programId],
  );
  const editStudentSemestersCount = editStudentProgram ? editStudentProgram.durationYears * 2 : 0;

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.user.firstName.toLowerCase().includes(q) ||
        t.user.lastName.toLowerCase().includes(q) ||
        t.user.email.toLowerCase().includes(q) ||
        t.employeeNo.toLowerCase().includes(q)
      );
    });
  }, [teachers, searchQuery]);

  /**
   * Semester options for the students filter. Derived from the students of the
   * currently selected program (across all statuses) so the list can never
   * offer a semester that matches nothing. Deliberately NOT narrowed by the
   * semester/status filters themselves, so the options stay stable while the
   * admin drills in.
   */
  // Derived from the full subject list, not the current page of students —
  // otherwise the dropdown options would change every time you page.
  const studentSemesterOptions = useMemo(() => {
    const semesters = new Set<number>();
    for (const s of subjects) {
      if (selectedProgramFilter !== "ALL" && s.programId !== selectedProgramFilter) continue;
      semesters.add(s.semester);
    }
    return [...semesters].sort((a, b) => a - b);
  }, [subjects, selectedProgramFilter]);

  /** Number of active student filters — drives the "Reset (n)" affordance. */
  const studentFilterCount =
    (selectedProgramFilter !== "ALL" ? 1 : 0) +
    (selectedSemesterFilter !== "ALL" ? 1 : 0) +
    (selectedStatusFilter !== "ALL" ? 1 : 0) +
    (studentSearch.trim() ? 1 : 0);

  function resetStudentFilters() {
    setSelectedProgramFilter("ALL");
    setSelectedSemesterFilter("ALL");
    setSelectedStatusFilter("ALL");
    setStudentSearch("");
  }

  // Open Edit Teacher modal
  function openEditTeacher(teacher: TeacherItem) {
    setError("");
    setMessage("");
    setEditingTeacher({
      id: teacher.id,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      email: teacher.user.email,
      password: "",
      employeeNo: teacher.employeeNo,
      profileImageUrl: teacher.profileImageUrl || "",
      subjectIds: (teacher.subjectTeachers ?? []).map((st) => st.subject.id),
      status: teacher.user.status,
    });
  }

  // Open Edit Student modal
  function openEditStudent(student: StudentItem) {
    setError("");
    setMessage("");
    setEditingStudent({
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      password: "",
      enrollmentNumber: student.enrollmentNumber,
      registrationId: student.registrationId,
      rollNumber: student.rollNumber || "",
      admissionDate: student.admissionDate ? new Date(student.admissionDate).toISOString().slice(0, 10) : "",
      programId: student.programId || "",
      currentSemester: student.currentSemester ? String(student.currentSemester) : "1",
      profileImageUrl: student.profileImageUrl || "",
      status: student.status || "ACTIVE",
      userStatus: student.user.status,
      gender: student.gender || "",
      nationality: student.nationality || "",
      religion: student.religion || "",
      category: student.category || "",
    });
  }

  // Handle Create Teacher
  async function handleCreateTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...teacherForm,
          subjectIds: teacherForm.subjectIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create teacher account");
        return;
      }
      const refresh = await fetch("/api/teachers");
      const refreshData = await refresh.json();
      setTeachers(refreshData.teachers ?? []);
      setTeacherForm(teacherEmpty);
      setShowTeacherModal(false);
      setMessage(`Faculty account created for ${data.teacher.user.firstName} ${data.teacher.user.lastName}.`);
    } catch {
      setError("Failed to create faculty account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Teacher
  async function handleUpdateTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTeacher) return;
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | string[] | undefined> = {
        id: editingTeacher.id,
        firstName: editingTeacher.firstName,
        lastName: editingTeacher.lastName,
        email: editingTeacher.email,
        employeeNo: editingTeacher.employeeNo,
        profileImageUrl: editingTeacher.profileImageUrl || undefined,
        subjectIds: editingTeacher.subjectIds,
        status: editingTeacher.status,
      };
      if (editingTeacher.password) {
        payload.password = editingTeacher.password;
      }

      const res = await fetch("/api/teachers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update faculty account");
        return;
      }
      const refresh = await fetch("/api/teachers");
      const refreshData = await refresh.json();
      setTeachers(refreshData.teachers ?? []);
      setEditingTeacher(null);
      setMessage(`Profile updated for ${data.teacher.user.firstName} ${data.teacher.user.lastName}.`);
    } catch {
      setError("Failed to update faculty account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Create Student
  async function handleCreateStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | number | undefined> = { ...studentForm };
      if (payload.currentSemester) payload.currentSemester = Number(payload.currentSemester);
      if (!payload.rollNumber) delete payload.rollNumber;
      if (!payload.programId) delete payload.programId;

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create student account");
        return;
      }
      await loadStudents(studentPage);
      setStudentForm(studentEmpty);
      setShowStudentModal(false);
      setMessage(`Student account created for ${data.student.user.firstName} ${data.student.user.lastName}.`);
    } catch {
      setError("Failed to create student account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Student
  async function handleUpdateStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingStudent) return;
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | number | undefined> = {
        id: editingStudent.id,
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        email: editingStudent.email,
        enrollmentNumber: editingStudent.enrollmentNumber,
        registrationId: editingStudent.registrationId,
        rollNumber: editingStudent.rollNumber || undefined,
        admissionDate: editingStudent.admissionDate,
        programId: editingStudent.programId || undefined,
        currentSemester: editingStudent.currentSemester ? Number(editingStudent.currentSemester) : undefined,
        profileImageUrl: editingStudent.profileImageUrl || undefined,
        gender: editingStudent.gender || undefined,
        nationality: editingStudent.nationality || undefined,
        religion: editingStudent.religion || undefined,
        category: editingStudent.category || undefined,
        status: editingStudent.status,
        userStatus: editingStudent.userStatus,
      };
      if (editingStudent.password) {
        payload.password = editingStudent.password;
      }

      const res = await fetch("/api/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update student account");
        return;
      }
      await loadStudents(studentPage);
      setEditingStudent(null);
      setMessage(`Student profile updated for ${data.student.user.firstName} ${data.student.user.lastName}.`);
    } catch {
      setError("Failed to update student account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete Confirmation
  async function handleConfirmDelete() {
    if (!deletingTarget) return;
    setError("");
    setSaving(true);
    const endpoint =
      deletingTarget.type === "teacher"
        ? `/api/teachers?id=${deletingTarget.id}`
        : `/api/students?id=${deletingTarget.id}`;
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete account");
        return;
      }
      if (deletingTarget.type === "teacher") {
        setTeachers((prev) => prev.filter((t) => t.id !== deletingTarget.id));
      } else {
        void loadStudents(studentPage);
      }
      setMessage(`${deletingTarget.name} has been removed successfully.`);
      setDeletingTarget(null);
    } catch {
      setError("Unable to process deletion");
    } finally {
      setSaving(false);
    }
  }

  // Handle Account Activation / Deactivation (quick per-row toggle).
  async function applyAccountStatus(userId: string, next: "ACTIVE" | "INACTIVE"): Promise<boolean> {
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update account status");
        return false;
      }
      setTeachers((prev) =>
        prev.map((t) => (t.user.id === userId ? { ...t, user: { ...t.user, status: next } } : t)),
      );
      void loadStudents(studentPage);
      return true;
    } catch {
      setError("Unable to update account status");
      return false;
    }
  }

  async function handleActivate(kind: "teacher" | "student", userId: string, name: string) {
    void kind;
    setError("");
    setSaving(true);
    const ok = await applyAccountStatus(userId, "ACTIVE");
    if (ok) {
      setMessage(`${name}'s account was reactivated — they can sign in again.`);
    }
    setSaving(false);
  }

  async function handleConfirmDeactivate() {
    if (!statusTarget) return;
    setError("");
    setSaving(true);
    const ok = await applyAccountStatus(statusTarget.userId, "INACTIVE");
    if (ok) {
      setMessage(
        `${statusTarget.name}'s account was deactivated — sign-in is blocked until reactivated.`,
      );
      setStatusTarget(null);
    }
    setSaving(false);
  }

  return (
    <AdminShell title="People & Accounts" subtitle="Teachers & Student Directory" active="/admin/people">
      <div className="flex flex-col gap-5">
        {/* Toolbar: tabs + tab-scoped action, then search / program filter */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "teachers" | "students")}>
              <TabsList>
                <TabsTrigger value="teachers">Teachers ({teachers.length})</TabsTrigger>
                <TabsTrigger value="students">
                  Enrolled Students ({studentPagination.total})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "teachers" ? (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setShowTeacherModal(true);
                  setError("");
                }}
              >
                <IconPlus size={15} aria-hidden="true" />
                Add Teacher
              </Button>
            ) : (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setShowStudentModal(true);
                  setError("");
                }}
              >
                <IconPlus size={15} aria-hidden="true" />
                Add Student
              </Button>
            )}
          </div>

          {/* Tab-scoped filter bar */}
          {activeTab === "teachers" ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-72">
                <IconSearch
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 z-[1] -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search teacher name, emp #, email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              {searchQuery && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                  Reset
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <Select
                  value={selectedProgramFilter}
                  onValueChange={(value) => {
                    setSelectedProgramFilter(value);
                    // Semesters are program-specific — drop a stale selection.
                    setSelectedSemesterFilter("ALL");
                  }}
                >
                  <SelectTrigger className="w-full sm:w-56" aria-label="Filter by program">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="ALL">All programs</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} · {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedSemesterFilter}
                  onValueChange={setSelectedSemesterFilter}
                  disabled={studentSemesterOptions.length === 0}
                >
                  <SelectTrigger className="w-full sm:w-36" aria-label="Filter by semester">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="ALL">All semesters</SelectItem>
                    {studentSemesterOptions.map((sem) => (
                      <SelectItem key={sem} value={String(sem)}>
                        Semester {sem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {ACCOUNT_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {titleCaseStatus(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-64">
                  <IconSearch
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 z-[1] -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="text"
                    placeholder="Search name, roll, reg #…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {studentFilterCount > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetStudentFilters}>
                    Reset ({studentFilterCount})
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {studentPagination.total === 0
                  ? "No students match the current filters"
                  : `Showing ${(studentPagination.page - 1) * studentPagination.pageSize + 1}\u2013${Math.min(studentPagination.page * studentPagination.pageSize, studentPagination.total)} of ${studentPagination.total} students`}
              </p>
            </div>
          )}
        </div>

        {/* Tab 1: Faculty table */}
        {activeTab === "teachers" && (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Faculty member</TableHead>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned subjects</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Loading directory…
                    </TableCell>
                  </TableRow>
                ) : filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No faculty records found. Click <strong className="font-medium text-foreground">Add Teacher</strong> to create an account.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            {t.profileImageUrl ? (
                              <AvatarImage
                                src={t.profileImageUrl}
                                alt={`${t.user.firstName} ${t.user.lastName}`}
                              />
                            ) : null}
                            <AvatarFallback className="text-xs font-semibold">
                              {initialsOf(t.user.firstName, t.user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {t.user.firstName} {t.user.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">Instructor / Faculty</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[13px] text-muted-foreground">{t.employeeNo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-52 truncate text-[13px] text-muted-foreground">
                          {t.user.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AccountStatusBadge status={t.user.status} />
                      </TableCell>
                      <TableCell>
                        {(t.subjectTeachers ?? []).length > 0 ? (
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {(t.subjectTeachers ?? []).map((st) => (
                              <Badge key={st.id} variant="secondary" className="font-medium">
                                {st.subject.code}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {t.user.status === "ACTIVE" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() =>
                                setStatusTarget({
                                  kind: "teacher",
                                  userId: t.user.id,
                                  name: `${t.user.firstName} ${t.user.lastName}`,
                                  identifier: t.employeeNo,
                                })
                              }
                              title="Deactivate Account (blocks sign-in)"
                              aria-label="Deactivate Faculty Account"
                            >
                              <IconUserOff size={15} />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() =>
                                handleActivate("teacher", t.user.id, `${t.user.firstName} ${t.user.lastName}`)
                              }
                              title="Activate Account"
                              aria-label="Activate Faculty Account"
                            >
                              <IconUserCheck size={15} />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditTeacher(t)}
                            title="Edit Faculty Profile"
                            aria-label="Edit Faculty Profile"
                          >
                            <IconPencil size={15} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setDeletingTarget({
                                type: "teacher",
                                id: t.id,
                                name: `${t.user.firstName} ${t.user.lastName}`,
                                identifier: t.employeeNo,
                              })
                            }
                            title="Delete Faculty Account"
                            aria-label="Delete Faculty Account"
                          >
                            <IconTrash size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Tab 2: Students table */}
        {activeTab === "students" && (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Student</TableHead>
                  <TableHead>Roll no</TableHead>
                  <TableHead>Enrollment & Reg ID</TableHead>
                  <TableHead>Program · Semester</TableHead>
                  <TableHead>Admission date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Loading directory…
                    </TableCell>
                  </TableRow>
                ) : studentsBusy && students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Loading students…
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {studentFilterCount > 0 ? (
                        <>
                          No students match the current filters.{" "}
                          <button
                            type="button"
                            onClick={resetStudentFilters}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          No student records found. Click{" "}
                          <strong className="font-medium text-foreground">Add Student</strong> to
                          enroll students.
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            {s.profileImageUrl ? (
                              <AvatarImage
                                src={s.profileImageUrl}
                                alt={`${s.user.firstName} ${s.user.lastName}`}
                              />
                            ) : null}
                            <AvatarFallback className="text-xs font-semibold">
                              {initialsOf(s.user.firstName, s.user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {s.user.firstName} {s.user.lastName}
                            </div>
                            <div className="max-w-52 truncate text-xs text-muted-foreground">
                              {s.user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.rollNumber ? (
                          <span className="font-mono text-[13px] text-muted-foreground">
                            #{s.rollNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.enrollmentNumber}</div>
                        <div className="font-mono text-xs text-muted-foreground">{s.registrationId}</div>
                      </TableCell>
                      <TableCell>
                        {s.program ? (
                          <div className="text-[13px]">
                            <span className="font-medium">{s.program.code}</span>
                            {s.currentSemester && (
                              <span className="text-muted-foreground"> · Sem {s.currentSemester}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] text-muted-foreground">
                          {new Date(s.admissionDate).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <AccountStatusBadge status={s.user.status} />
                          {s.status && s.status !== "ACTIVE" && (
                            <Badge variant="outline" title="Enrollment status">
                              {titleCaseStatus(s.status)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {s.user.status === "ACTIVE" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() =>
                                setStatusTarget({
                                  kind: "student",
                                  userId: s.user.id,
                                  name: `${s.user.firstName} ${s.user.lastName}`,
                                  identifier: s.enrollmentNumber,
                                })
                              }
                              title="Deactivate Account (blocks sign-in)"
                              aria-label="Deactivate Student Account"
                            >
                              <IconUserOff size={15} />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              onClick={() =>
                                handleActivate("student", s.user.id, `${s.user.firstName} ${s.user.lastName}`)
                              }
                              title="Activate Account"
                              aria-label="Activate Student Account"
                            >
                              <IconUserCheck size={15} />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditStudent(s)}
                            title="Edit Student Profile"
                            aria-label="Edit Student Profile"
                          >
                            <IconPencil size={15} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setDeletingTarget({
                                type: "student",
                                id: s.id,
                                name: `${s.user.firstName} ${s.user.lastName}`,
                                identifier: s.enrollmentNumber,
                              })
                            }
                            title="Delete Student Account"
                            aria-label="Delete Student Account"
                          >
                            <IconTrash size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              pagination={studentPagination}
              busy={studentsBusy}
              label="students"
              onPageChange={(next) => {
                setStudentPage(next);
                void loadStudents(next);
              }}
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

        {/* Modal 1: Create Faculty */}
        {showTeacherModal && (
          <AdminModal
            title="Create Faculty / Teacher Account"
            wide
            onClose={() => {
              setShowTeacherModal(false);
              setTeacherForm(teacherEmpty);
            }}
          >
            <form className="grid gap-4" onSubmit={handleCreateTeacher}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="tf-first">First name</Label>
                  <Input
                    id="tf-first"
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={teacherForm.firstName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tf-last">Last name</Label>
                  <Input
                    id="tf-last"
                    type="text"
                    placeholder="e.g. Sharma"
                    value={teacherForm.lastName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="tf-emp">Employee ID number</Label>
                  <Input
                    id="tf-emp"
                    type="text"
                    placeholder="e.g. FWU-EMP-101"
                    value={teacherForm.employeeNo}
                    onChange={(e) => setTeacherForm({ ...teacherForm, employeeNo: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tf-email">Email address</Label>
                  <Input
                    id="tf-email"
                    type="email"
                    placeholder="faculty@fwu.edu.np"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="tf-password">Account password</Label>
                <Input
                  id="tf-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                  required
                />
              </div>

              <ImageUploadCrop
                label="Profile Photo (Crop to Square)"
                value={teacherForm.profileImageUrl || ""}
                onChange={(val) => setTeacherForm({ ...teacherForm, profileImageUrl: val })}
              />

              <SubjectAssigner
                subjects={subjects}
                assignedIds={teacherForm.subjectIds}
                onChange={(next) => setTeacherForm((f) => ({ ...f, subjectIds: next }))}
              />

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    "Creating…"
                  ) : (
                    <>
                      <IconPlus size={15} aria-hidden="true" />
                      Create Faculty Account
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowTeacherModal(false);
                    setTeacherForm(teacherEmpty);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal 2: Edit Faculty */}
        {editingTeacher && (
          <AdminModal
            title={`Edit Faculty: ${editingTeacher.firstName} ${editingTeacher.lastName}`}
            wide
            onClose={() => setEditingTeacher(null)}
          >
            <form className="grid gap-4" onSubmit={handleUpdateTeacher}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="te-first">First name</Label>
                  <Input
                    id="te-first"
                    type="text"
                    value={editingTeacher.firstName}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="te-last">Last name</Label>
                  <Input
                    id="te-last"
                    type="text"
                    value={editingTeacher.lastName}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="te-emp">Employee ID number</Label>
                  <Input
                    id="te-emp"
                    type="text"
                    value={editingTeacher.employeeNo}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, employeeNo: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="te-email">Email address</Label>
                  <Input
                    id="te-email"
                    type="email"
                    value={editingTeacher.email}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="te-password">Change password (optional)</Label>
                  <Input
                    id="te-password"
                    type="password"
                    placeholder="Leave blank to keep existing password"
                    value={editingTeacher.password}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="te-status">Account status</Label>
                  <Select
                    value={editingTeacher.status}
                    onValueChange={(status) => setEditingTeacher({ ...editingTeacher, status })}
                  >
                    <SelectTrigger id="te-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ACTIVE">Active — can sign in</SelectItem>
                      <SelectItem value="INACTIVE">Inactive — sign-in blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ImageUploadCrop
                label="Profile Photo (Crop to Square)"
                value={editingTeacher.profileImageUrl || ""}
                onChange={(val) => setEditingTeacher({ ...editingTeacher, profileImageUrl: val })}
              />

              <SubjectAssigner
                subjects={subjects}
                assignedIds={editingTeacher.subjectIds}
                onChange={(next) =>
                  setEditingTeacher((t) => (t ? { ...t, subjectIds: next } : t))
                }
              />

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving Changes…" : "Save Changes"}
                </Button>
                <Button variant="outline" type="button" onClick={() => setEditingTeacher(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal 3: Create Student */}
        {showStudentModal && (
          <AdminModal
            title="Enroll New Student"
            wide
            onClose={() => {
              setShowStudentModal(false);
              setStudentForm(studentEmpty);
            }}
          >
            <form className="grid gap-4" onSubmit={handleCreateStudent}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-first">First name</Label>
                  <Input
                    id="sf-first"
                    type="text"
                    placeholder="e.g. Aarav"
                    value={studentForm.firstName}
                    onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-last">Last name</Label>
                  <Input
                    id="sf-last"
                    type="text"
                    placeholder="e.g. Adhikari"
                    value={studentForm.lastName}
                    onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-email">Email address</Label>
                  <Input
                    id="sf-email"
                    type="email"
                    placeholder="student@fwu.edu.np"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-password">Account password</Label>
                  <Input
                    id="sf-password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-enrollment">Enrollment number</Label>
                  <Input
                    id="sf-enrollment"
                    type="text"
                    placeholder="e.g. 2024-BCT-01"
                    value={studentForm.enrollmentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-registration">Registration ID</Label>
                  <Input
                    id="sf-registration"
                    type="text"
                    placeholder="e.g. REG-2024-001"
                    value={studentForm.registrationId}
                    onChange={(e) => setStudentForm({ ...studentForm, registrationId: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-roll">Roll number (optional)</Label>
                  <Input
                    id="sf-roll"
                    type="text"
                    placeholder="e.g. 01"
                    value={studentForm.rollNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-admission">Admission date</Label>
                  <Input
                    id="sf-admission"
                    type="date"
                    value={studentForm.admissionDate}
                    onChange={(e) => setStudentForm({ ...studentForm, admissionDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-program">Academic program</Label>
                  <Select
                    value={studentForm.programId || undefined}
                    onValueChange={(programId) =>
                      setStudentForm({ ...studentForm, programId, currentSemester: "1" })
                    }
                  >
                    <SelectTrigger id="sf-program" className="w-full">
                      <SelectValue placeholder="No program assigned yet" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sf-semester">Current semester</Label>
                  <Select
                    value={studentForm.currentSemester || undefined}
                    onValueChange={(currentSemester) =>
                      setStudentForm({ ...studentForm, currentSemester })
                    }
                    disabled={!studentForm.programId}
                  >
                    <SelectTrigger id="sf-semester" className="w-full">
                      <SelectValue
                        placeholder={
                          studentForm.programId ? "Select semester" : "Pick program first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {Array.from({ length: createStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Semester {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Personal information below is critical — only admins can set it, students cannot
                change it later. Contact &amp; guardian details are filled in by the student from
                their own profile.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-gender">Gender</Label>
                  <Select
                    value={studentForm.gender || "UNSPECIFIED"}
                    onValueChange={(v) =>
                      setStudentForm({ ...studentForm, gender: v === "UNSPECIFIED" ? "" : v })
                    }
                  >
                    <SelectTrigger id="sf-gender" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-category">Category</Label>
                  <Input
                    id="sf-category"
                    type="text"
                    placeholder="e.g. Open, Reserved"
                    value={studentForm.category}
                    onChange={(e) => setStudentForm({ ...studentForm, category: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-nationality">Nationality</Label>
                  <Input
                    id="sf-nationality"
                    type="text"
                    placeholder="e.g. Nepali"
                    value={studentForm.nationality}
                    onChange={(e) => setStudentForm({ ...studentForm, nationality: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sf-religion">Religion</Label>
                  <Input
                    id="sf-religion"
                    type="text"
                    placeholder="e.g. Hindu"
                    value={studentForm.religion}
                    onChange={(e) => setStudentForm({ ...studentForm, religion: e.target.value })}
                  />
                </div>
              </div>

              <ImageUploadCrop
                label="Profile Photo (Crop to Square)"
                value={studentForm.profileImageUrl || ""}
                onChange={(val) => setStudentForm({ ...studentForm, profileImageUrl: val })}
              />

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    "Creating…"
                  ) : (
                    <>
                      <IconPlus size={15} aria-hidden="true" />
                      Create Student Account
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowStudentModal(false);
                    setStudentForm(studentEmpty);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal 4: Edit Student */}
        {editingStudent && (
          <AdminModal
            title={`Edit Student: ${editingStudent.firstName} ${editingStudent.lastName}`}
            wide
            onClose={() => setEditingStudent(null)}
          >
            <form className="grid gap-4" onSubmit={handleUpdateStudent}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-first">First name</Label>
                  <Input
                    id="se-first"
                    type="text"
                    value={editingStudent.firstName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-last">Last name</Label>
                  <Input
                    id="se-last"
                    type="text"
                    value={editingStudent.lastName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-email">Email address</Label>
                  <Input
                    id="se-email"
                    type="email"
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-password">Change password (optional)</Label>
                  <Input
                    id="se-password"
                    type="password"
                    placeholder="Leave blank to keep existing"
                    value={editingStudent.password}
                    onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-enrollment">Enrollment number</Label>
                  <Input
                    id="se-enrollment"
                    type="text"
                    value={editingStudent.enrollmentNumber}
                    onChange={(e) => setEditingStudent({ ...editingStudent, enrollmentNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-registration">Registration ID</Label>
                  <Input
                    id="se-registration"
                    type="text"
                    value={editingStudent.registrationId}
                    onChange={(e) => setEditingStudent({ ...editingStudent, registrationId: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-roll">Roll number (optional)</Label>
                  <Input
                    id="se-roll"
                    type="text"
                    value={editingStudent.rollNumber}
                    onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-admission">Admission date</Label>
                  <Input
                    id="se-admission"
                    type="date"
                    value={editingStudent.admissionDate}
                    onChange={(e) => setEditingStudent({ ...editingStudent, admissionDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-program">Academic program</Label>
                  <Select
                    value={editingStudent.programId || undefined}
                    onValueChange={(programId) =>
                      setEditingStudent({ ...editingStudent, programId, currentSemester: "1" })
                    }
                  >
                    <SelectTrigger id="se-program" className="w-full">
                      <SelectValue placeholder="No program assigned yet" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="se-semester">Current semester</Label>
                  <Select
                    value={editingStudent.currentSemester || undefined}
                    onValueChange={(currentSemester) =>
                      setEditingStudent({ ...editingStudent, currentSemester })
                    }
                    disabled={!editingStudent.programId}
                  >
                    <SelectTrigger id="se-semester" className="w-full">
                      <SelectValue
                        placeholder={
                          editingStudent.programId ? "Select semester" : "Pick program first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {Array.from({ length: editStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Semester {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-status">Enrollment status</Label>
                  <Select
                    value={editingStudent.status}
                    onValueChange={(status) => setEditingStudent({ ...editingStudent, status })}
                  >
                    <SelectTrigger id="se-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="GRADUATED">Graduated</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-access">Account access</Label>
                  <Select
                    value={editingStudent.userStatus}
                    onValueChange={(userStatus) =>
                      setEditingStudent({ ...editingStudent, userStatus })
                    }
                  >
                    <SelectTrigger id="se-access" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ACTIVE">Active — can sign in</SelectItem>
                      <SelectItem value="INACTIVE">Inactive — sign-in blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Personal information below is critical — only admins can set it, students cannot
                change it later.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-gender">Gender</Label>
                  <Select
                    value={editingStudent.gender || "UNSPECIFIED"}
                    onValueChange={(v) =>
                      setEditingStudent({ ...editingStudent, gender: v === "UNSPECIFIED" ? "" : v })
                    }
                  >
                    <SelectTrigger id="se-gender" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-category">Category</Label>
                  <Input
                    id="se-category"
                    type="text"
                    placeholder="e.g. Open, Reserved"
                    value={editingStudent.category}
                    onChange={(e) => setEditingStudent({ ...editingStudent, category: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="se-nationality">Nationality</Label>
                  <Input
                    id="se-nationality"
                    type="text"
                    placeholder="e.g. Nepali"
                    value={editingStudent.nationality}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nationality: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="se-religion">Religion</Label>
                  <Input
                    id="se-religion"
                    type="text"
                    placeholder="e.g. Hindu"
                    value={editingStudent.religion}
                    onChange={(e) => setEditingStudent({ ...editingStudent, religion: e.target.value })}
                  />
                </div>
              </div>

              <ImageUploadCrop
                label="Profile Photo (Crop to Square)"
                value={editingStudent.profileImageUrl || ""}
                onChange={(val) => setEditingStudent({ ...editingStudent, profileImageUrl: val })}
              />

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving Changes…" : "Save Changes"}
                </Button>
                <Button variant="outline" type="button" onClick={() => setEditingStudent(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal 5: Delete Confirmation */}
        {deletingTarget && (
          <AdminModal
            title={`Delete ${deletingTarget.type === "teacher" ? "Faculty" : "Student"} Account`}
            onClose={() => setDeletingTarget(null)}
          >
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Are you sure you want to permanently delete the account for{" "}
                <strong className="text-foreground">{deletingTarget.name}</strong>{" "}
                ({deletingTarget.identifier})?
              </p>
              <p className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/20">
                <IconAlertTriangle size={16} aria-hidden="true" className="shrink-0" />
                This action cannot be undone. All associated records, enrollments, attendance, and
                credentials will be removed.
              </p>

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button variant="destructive" type="button" onClick={handleConfirmDelete} disabled={saving}>
                  {saving ? "Deleting…" : "Yes, Delete Account"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeletingTarget(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AdminModal>
        )}

        {/* Modal 6: Deactivate Confirmation (activation is applied directly) */}
        {statusTarget && (
          <AdminModal title="Deactivate Account" onClose={() => setStatusTarget(null)}>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Deactivate the account for{" "}
                <strong className="text-foreground">{statusTarget.name}</strong>{" "}
                ({statusTarget.identifier})?
              </p>
              <p className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400">
                <IconAlertTriangle size={16} aria-hidden="true" className="shrink-0" />
                They will no longer be able to sign in and their profile will be hidden from the
                directory. All records are preserved, and you can reactivate the account at any
                time.
              </p>
              {statusTarget.kind === "student" && (
                <p className="text-[13px]">
                  Note: this only controls portal access. To change the student&apos;s enrollment
                  status (Active / Graduated / Withdrawn…), use <strong className="font-medium text-foreground">Edit Student Profile</strong>.
                </p>
              )}

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleConfirmDeactivate}
                  disabled={saving}
                >
                  {saving ? "Deactivating…" : "Yes, Deactivate Account"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStatusTarget(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}
