"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";

type ProgramOption = { id: string; name: string; code: string; durationYears: number };
type SubjectOption = { id: string; name: string; code: string; programId: string; semester: number };
type TeacherOption = { id: string; name: string; code: string };

const emptySubject = { name: "", code: "", programId: "", semester: "" };
const emptyClass = {
  subjectId: "",
  teacherId: "",
  programId: "",
  semester: "",
  dayOfWeek: "MONDAY",
  startTime: "09:00",
  endTime: "10:00",
};

function semesterOptions(program: ProgramOption | undefined) {
  if (!program) return [];
  const total = program.durationYears * 2;
  return Array.from({ length: total }, (_, i) => ({
    id: String(i + 1),
    name: `Semester ${i + 1}`,
    code: "",
  }));
}

export default function AdminTeachingPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subject, setSubject] = useState(emptySubject);
  const [classForm, setClassForm] = useState(emptyClass);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") return router.replace("/");
      const [p, s, t] = await Promise.all([
        fetch("/api/programs"),
        fetch("/api/subjects"),
        fetch("/api/teachers"),
      ]);
      const [pd, sd, td] = await Promise.all([p.json(), s.json(), t.json()]);
      setPrograms(pd.programs ?? []);
      setSubjects(sd.subjects ?? []);
      setTeachers(
        (td.teachers ?? []).map(
          (x: { id: string; employeeNo: string; user: { firstName: string; lastName: string } }) => ({
            id: x.id,
            code: x.employeeNo,
            name: `${x.user.firstName} ${x.user.lastName}`,
          }),
        ),
      );
    }
    load().catch(() => setError("Unable to load academic records"));
  }, [router]);

  async function create(e: FormEvent<HTMLFormElement>, endpoint: string, payload: object, reset: () => void) {
    e.preventDefault();
    setError("");
    setMessage("");
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) return setError(data.error ?? "Unable to save record");
    reset();
    setMessage("Record created successfully");
    if (endpoint === "/api/subjects") setSubjects([...subjects, data.subject]);
  }

  const selectedSubjectProgram = programs.find((p) => p.id === subject.programId);
  const selectedClassProgram = programs.find((p) => p.id === classForm.programId);

  const classSubjects = subjects.filter(
    (x) =>
      x.programId === classForm.programId && x.semester === Number(classForm.semester),
  );

  return (
    <AdminShell title="Subjects & Classes" subtitle="Curriculum & Timetable Setup" active="/admin/teaching">
      <section className="admin-form-layout">
        {/* Create Subject */}
        <article className="profile-info-card admin-form-card">
          <h2>Create a Subject</h2>
          <form
            onSubmit={(e) =>
              create(
                e,
                "/api/subjects",
                { ...subject, semester: Number(subject.semester) },
                () => setSubject(emptySubject),
              )
            }
          >
            <label>
              Program
              <Select
                value={subject.programId}
                options={programs.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                onChange={(v) => setSubject({ ...subject, programId: v, semester: "" })}
              />
            </label>
            <label>
              Semester
              <Select
                value={subject.semester}
                options={semesterOptions(selectedSubjectProgram)}
                onChange={(v) => setSubject({ ...subject, semester: v })}
              />
            </label>
            <label>
              Subject Name
              <input
                value={subject.name}
                onChange={(e) => setSubject({ ...subject, name: e.target.value })}
                required
              />
            </label>
            <label>
              Subject Code
              <input
                value={subject.code}
                onChange={(e) => setSubject({ ...subject, code: e.target.value })}
                required
              />
            </label>
            <button className="admin-primary" type="submit">
              + Create Subject
            </button>
          </form>
        </article>

        {/* Create Class */}
        <article className="profile-info-card admin-form-card">
          <h2>Create a Class / Lecture</h2>
          <form
            onSubmit={(e) =>
              create(
                e,
                "/api/classes",
                { ...classForm, semester: Number(classForm.semester) },
                () => setClassForm(emptyClass),
              )
            }
          >
            <label>
              Program
              <Select
                value={classForm.programId}
                options={programs.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                onChange={(v) =>
                  setClassForm({ ...classForm, programId: v, semester: "", subjectId: "" })
                }
              />
            </label>
            <label>
              Semester
              <Select
                value={classForm.semester}
                options={semesterOptions(selectedClassProgram)}
                onChange={(v) => setClassForm({ ...classForm, semester: v, subjectId: "" })}
              />
            </label>
            <label>
              Subject
              <Select
                value={classForm.subjectId}
                options={classSubjects.map((x) => ({ id: x.id, name: x.name, code: x.code }))}
                onChange={(v) => setClassForm({ ...classForm, subjectId: v })}
              />
            </label>
            <label>
              Teacher / Faculty
              <Select
                value={classForm.teacherId}
                options={teachers}
                onChange={(v) => setClassForm({ ...classForm, teacherId: v })}
              />
            </label>
            <label>
              Weekday
              <select
                value={classForm.dayOfWeek}
                onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value })}
              >
                {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
                  (day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="admin-inline-fields">
              <label>
                Starts
                <input
                  type="time"
                  value={classForm.startTime}
                  onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                Ends
                <input
                  type="time"
                  value={classForm.endTime}
                  onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                  required
                />
              </label>
            </div>
            <button className="admin-primary" type="submit">
              + Create Class Slot
            </button>
          </form>
        </article>
      </section>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}
    </AdminShell>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string; code: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Select a record</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.code ? `${item.code} · ` : ""}
          {item.name}
        </option>
      ))}
    </select>
  );
}
