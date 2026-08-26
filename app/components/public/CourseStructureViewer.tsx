"use client";

import { useEffect, useMemo, useState } from "react";

type Program = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentName: string;
};

type CurriculumCourse = {
  id: string;
  code: string | null;
  name: string;
  credits: number;
  sortOrder: number;
};

type CurriculumSemester = {
  id: string;
  semesterNo: number;
  label: string;
  courses: CurriculumCourse[];
};

type CurriculumYear = {
  id: string;
  yearNo: number;
  label: string;
  semesters: CurriculumSemester[];
};

type CurriculumElective = {
  id: string;
  group: string;
  code: string | null;
  name: string;
  credits: number;
  sortOrder: number;
};

type Curriculum = {
  programId: string;
  years: CurriculumYear[];
  electives: CurriculumElective[];
};

export function CourseStructureViewer() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [error, setError] = useState("");

  const [department, setDepartment] = useState("");
  const [programId, setProgramId] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  // 1. Load programs for the dropdowns.
  useEffect(() => {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load programs");
        return data.programs ?? [];
      })
      .then((loaded: Program[]) => {
        setPrograms(loaded);
        if (loaded.length > 0) setDepartment(loaded[0].departmentName);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoadingPrograms(false));
  }, []);

  const departments = useMemo(
    () =>
      [...new Set(programs.map((p) => p.departmentName))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [programs],
  );

  const programOptions = useMemo(
    () =>
      programs
        .filter((p) => p.departmentName === department)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [programs, department],
  );

  // 2. Auto-select the first program when the department changes and no
  //    program is currently selected.
  useEffect(() => {
    if (!programId && programOptions.length > 0) {
      setProgramId(programOptions[0].id);
    }
  }, [programOptions, programId]);

  // 3. Load the selected program's curriculum from the database.
  useEffect(() => {
    if (!programId) {
      setCurriculum(null);
      return;
    }
    let cancelled = false;
    setLoadingCurriculum(true);
    setError("");
    fetch(`/api/curriculum?programId=${programId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load curriculum");
        return data.curriculum as Curriculum | null;
      })
      .then((data) => {
        if (!cancelled) setCurriculum(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingCurriculum(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  function selectDepartment(dept: string) {
    setDepartment(dept);
    setProgramId("");
    setCurriculum(null);
  }

  const selectedProgram = programOptions.find((p) => p.id === programId);

  return (
    <div className="cs-root">
      {/* ─── Selectors ─────────────────────────────────────────────── */}
      <div className="cs-selectors">
        <label className="cs-field">
          <span>Department</span>
          <select
            value={department}
            onChange={(e) => selectDepartment(e.target.value)}
            disabled={loadingPrograms || departments.length === 0}
          >
            {departments.length === 0 && <option value="">Loading…</option>}
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </label>

        <label className="cs-field">
          <span>Program</span>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={programOptions.length === 0}
          >
            {programOptions.length === 0 && <option value="">Loading…</option>}
            {programOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="cs-empty" role="alert">
          {error}
        </p>
      )}

      {loadingCurriculum && <p className="cs-empty">Loading curriculum…</p>}

      {/* ─── Timeline ──────────────────────────────────────────────── */}
      {!loadingCurriculum && curriculum && selectedProgram && (
        <div className="cs-detail">
          <header className="cs-program-header">
            <h2>{selectedProgram.name}</h2>
            {selectedProgram.departmentName && (
              <p>{selectedProgram.departmentName}</p>
            )}
          </header>

          <div className="curriculum-timeline">
            {curriculum.years.map((year) => (
              <div className="curriculum-era" key={year.id}>
                <div className="curriculum-era-title">{year.label}</div>

                {year.semesters.map((semester) => {
                  const totalCredits = semester.courses.reduce(
                    (sum, c) => sum + c.credits,
                    0,
                  );
                  return (
                    <div className="curriculum-sem" key={semester.id}>
                      <div className="curriculum-sem-left">
                        <span className="curriculum-sem-label">
                          {semester.label}
                        </span>
                        <span className="curriculum-sem-credits">
                          {totalCredits} cr
                        </span>
                      </div>

                      <div className="curriculum-track" aria-hidden="true">
                        <span className="curriculum-dot" />
                      </div>

                      <div className="curriculum-card">
                        <table className="curriculum-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Course</th>
                              <th className="num">Cr</th>
                            </tr>
                          </thead>
                          <tbody>
                            {semester.courses.map((course) => (
                              <tr key={course.id}>
                                <td className="code">
                                  {course.code ?? "—"}
                                </td>
                                <td className="name">{course.name}</td>
                                <td className="num">{course.credits}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2}>Semester Total</td>
                              <td className="num">{totalCredits}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {curriculum.electives && curriculum.electives.length > 0 && (
            <div className="curriculum-electives">
              <h3>Electives</h3>
              {(["ELECTIVE_I", "ELECTIVE_II"] as const).map((group) => {
                const items = curriculum.electives.filter(
                  (e) => e.group === group,
                );
                if (items.length === 0) return null;
                return (
                  <div className="curriculum-elective" key={group}>
                    <strong>
                      {group === "ELECTIVE_I" ? "Elective-I" : "Elective-II"}
                    </strong>
                    <ul>
                      {items.map((e) => (
                        <li key={e.id}>
                          <span className="code">{e.code ?? "—"}</span>
                          {e.name}
                          <span className="num">{e.credits} cr</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loadingCurriculum &&
        !loadingPrograms &&
        !error &&
        curriculum === null && (
          <p className="cs-empty">
            No curriculum published for this program yet.
          </p>
        )}
    </div>
  );
}