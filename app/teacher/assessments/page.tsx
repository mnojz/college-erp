"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";

type Student = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  user: { firstName: string; lastName: string };
};

type ClassItem = {
  id: string;
  subjectId: string;
  programId: string;
  semester: number;
  subject: { code: string; name: string };
  program: {
    id: string;
    name: string;
    code: string;
    students: Student[];
  };
};

type Assessment = {
  id: string;
  name: string;
  maxMarks: number | string;
  assessmentDate: string | null;
  subjectId: string;
  programId: string;
  semester: number;
  subject: { code: string; name: string };
  program: { code: string; name: string };
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

export default function TeacherAssessmentsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [marksState, setMarksState] = useState<Record<string, { marks: string; grade: string }>>({});

  // New assessment form state
  const [selectedClassIndex, setSelectedClassIndex] = useState("0");
  const [assessmentName, setAssessmentName] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingMarks, setIsSubmittingMarks] = useState(false);
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [classesRes, assessmentsRes, profRes] = await Promise.all([
          fetch("/api/attendance"),
          fetch("/api/assessments"),
          fetch("/api/teacher/profile"),
        ]);

        if (
          classesRes.status === 401 ||
          classesRes.status === 403 ||
          profRes.status === 401 ||
          profRes.status === 403
        ) {
          router.replace("/");
          return;
        }

        const classesData = await classesRes.json();
        const assessmentsData = await assessmentsRes.json();
        const profData = await profRes.json();

        setClasses(classesData.classes ?? []);
        const loadedAssessments: Assessment[] = assessmentsData.assessments ?? [];
        setAssessments(loadedAssessments);

        if (loadedAssessments.length > 0) {
          setSelectedAssessmentId(loadedAssessments[0].id);
        }

        if (profRes.ok && profData.teacher) {
          setTeacherInfo({
            firstName: profData.teacher.user.firstName,
            lastName: profData.teacher.user.lastName,
            employeeNo: profData.teacher.employeeNo,
            profileImageUrl: profData.teacher.profileImageUrl,
          });
        }
      } catch {
        setError("Unable to load teaching and assessment records");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === selectedAssessmentId),
    [assessments, selectedAssessmentId],
  );

  // Find students belonging to the program of the selected assessment
  const relevantStudents = useMemo(() => {
    if (!selectedAssessment) return [];
    const matchedClass =
      classes.find(
        (c) =>
          c.subjectId === selectedAssessment.subjectId &&
          c.programId === selectedAssessment.programId,
      ) || classes.find((c) => c.programId === selectedAssessment.programId);
    return matchedClass?.program.students ?? [];
  }, [selectedAssessment, classes]);

  async function handleCreateAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsCreatingAssessment(true);

    const chosenClass = classes[Number(selectedClassIndex)];
    if (!chosenClass) {
      setError("Please select a valid class");
      setIsCreatingAssessment(false);
      return;
    }

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: chosenClass.subjectId,
          programId: chosenClass.programId,
          semester: chosenClass.semester,
          name: assessmentName,
          maxMarks: Number(maxMarks),
          assessmentDate: new Date(assessmentDate).toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to create assessment");
        return;
      }

      setMessage(`Assessment "${assessmentName}" created successfully!`);
      setAssessmentName("");

      // Refresh assessments list
      const reload = await fetch("/api/assessments");
      const reloadedData = await reload.json();
      const newAssessments = reloadedData.assessments ?? [];
      setAssessments(newAssessments);
      setSelectedAssessmentId(data.assessment.id);
    } catch {
      setError("Failed to create assessment");
    } finally {
      setIsCreatingAssessment(false);
    }
  }

  async function handleSaveResults() {
    if (!selectedAssessment) return;
    setError("");
    setMessage("");
    setIsSubmittingMarks(true);

    const resultsToSubmit = relevantStudents
      .filter((s) => marksState[s.id]?.marks !== undefined && marksState[s.id]?.marks !== "")
      .map((s) => ({
        studentId: s.id,
        marks: Number(marksState[s.id].marks),
        grade: marksState[s.id].grade || null,
      }));

    if (resultsToSubmit.length === 0) {
      setError("Please enter marks for at least one student before saving.");
      setIsSubmittingMarks(false);
      return;
    }

    // Validate marks don't exceed maxMarks
    const max = Number(selectedAssessment.maxMarks);
    if (resultsToSubmit.some((r) => r.marks < 0 || r.marks > max)) {
      setError(`Marks must be between 0 and ${max}`);
      setIsSubmittingMarks(false);
      return;
    }

    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssessment.id,
          results: resultsToSubmit,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to save results");
        return;
      }

      setMessage(`Grades successfully saved for ${resultsToSubmit.length} student(s).`);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSubmittingMarks(false);
    }
  }

  return (
    <TeacherShell
      title="Assessments &amp; Student Grading"
      subtitle="Evaluation & Marks Management"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {/* Alert Messages */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="status"
        >
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "24px" }}>
        {/* Create Assessment Card */}
        <section className="profile-info-card" style={{ padding: "24px", height: "fit-content" }}>
          <h2
            style={{
              padding: "0 0 14px 0",
              fontSize: "1.15rem",
              fontWeight: "700",
              borderBottom: "1px solid var(--line, #e2e8f0)",
            }}
          >
            Create New Assessment
          </h2>

          <form onSubmit={handleCreateAssessment} style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Class / Subject
              </label>
              <select
                value={selectedClassIndex}
                onChange={(e) => setSelectedClassIndex(e.target.value)}
                disabled={classes.length === 0}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "var(--panel, #fff)",
                  color: "inherit",
                }}
              >
                {classes.map((c, i) => (
                  <option key={c.id} value={i}>
                    {c.subject.code} · {c.subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Assessment Title
              </label>
              <input
                type="text"
                placeholder="e.g. Mid-Term Exam, Quiz 1, Project"
                value={assessmentName}
                onChange={(e) => setAssessmentName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "var(--panel, #fff)",
                  color: "inherit",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  Maximum Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line, #e2e8f0)",
                    background: "var(--panel, #fff)",
                    color: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  Assessment Date
                </label>
                <input
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line, #e2e8f0)",
                    background: "var(--panel, #fff)",
                    color: "inherit",
                  }}
                />
              </div>
            </div>

            <button
              className="primary-button"
              type="submit"
              disabled={isCreatingAssessment || classes.length === 0}
              style={{
                marginTop: "6px",
                padding: "10px 18px",
                borderRadius: "8px",
                background: "#0ea5e9",
                color: "#fff",
                fontWeight: "700",
                fontSize: "0.85rem",
                border: 0,
                cursor: "pointer",
              }}
            >
              {isCreatingAssessment ? "Creating Assessment..." : "+ Create Assessment"}
            </button>
          </form>
        </section>

        {/* Enter Marks & Grading Card */}
        <section className="profile-info-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.15rem", fontWeight: "700" }}>
              Enter Student Grades
            </h2>
            <select
              value={selectedAssessmentId}
              onChange={(e) => {
                setSelectedAssessmentId(e.target.value);
                setMarksState({});
                setMessage("");
                setError("");
              }}
              style={{
                minWidth: "220px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line, #e2e8f0)",
                fontSize: "0.82rem",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
              disabled={assessments.length === 0}
            >
              {assessments.length === 0 && <option value="">No assessments created</option>}
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.subject.code} · {a.name} (Max: {String(a.maxMarks)})
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
              Loading assessment data...
            </p>
          ) : !selectedAssessment ? (
            <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
              Create an assessment to start recording student grades.
            </p>
          ) : (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(14, 165, 233, 0.08)",
                  fontSize: "0.82rem",
                  marginBottom: "16px",
                }}
              >
                <span>
                  Subject: <strong>{selectedAssessment.subject.name}</strong> ({selectedAssessment.subject.code})
                </span>
                <span>
                  Max Marks: <strong>{String(selectedAssessment.maxMarks)}</strong>
                </span>
              </div>

              {relevantStudents.length === 0 ? (
                <p className="empty-state" style={{ textAlign: "center", padding: "30px 0" }}>
                  No enrolled students found in this program.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      maxHeight: "400px",
                      overflowY: "auto",
                      border: "1px solid var(--line, #e2e8f0)",
                      borderRadius: "8px",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        textAlign: "left",
                        fontSize: "0.85rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid var(--line, #e2e8f0)",
                            color: "var(--ink-soft)",
                          }}
                        >
                          <th style={{ padding: "10px 14px", fontWeight: "600" }}>Roll / Enrollment</th>
                          <th style={{ padding: "10px 14px", fontWeight: "600" }}>Student Name</th>
                          <th style={{ padding: "10px 14px", width: "120px", fontWeight: "600" }}>Marks</th>
                          <th style={{ padding: "10px 14px", width: "90px", fontWeight: "600" }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relevantStudents.map((s) => {
                          const currentMarks = marksState[s.id]?.marks ?? "";
                          const currentGrade = marksState[s.id]?.grade ?? "";

                          return (
                            <tr key={s.id} style={{ borderBottom: "1px solid var(--line, #e2e8f0)" }}>
                              <td style={{ padding: "10px 14px", fontWeight: "600" }}>
                                {s.rollNumber || s.enrollmentNumber}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {s.user.firstName} {s.user.lastName}
                              </td>
                              <td style={{ padding: "6px 14px" }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={String(selectedAssessment.maxMarks)}
                                  placeholder="0.0"
                                  step="0.5"
                                  value={currentMarks}
                                  onChange={(e) =>
                                    setMarksState({
                                      ...marksState,
                                      [s.id]: { ...marksState[s.id], marks: e.target.value },
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--line, #e2e8f0)",
                                    background: "var(--panel, #fff)",
                                    color: "inherit",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "6px 14px" }}>
                                <input
                                  type="text"
                                  placeholder="A/B/C"
                                  maxLength={3}
                                  value={currentGrade}
                                  onChange={(e) =>
                                    setMarksState({
                                      ...marksState,
                                      [s.id]: { ...marksState[s.id], grade: e.target.value.toUpperCase() },
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--line, #e2e8f0)",
                                    background: "var(--panel, #fff)",
                                    color: "inherit",
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={handleSaveResults}
                      disabled={isSubmittingMarks}
                      style={{
                        padding: "10px 24px",
                        borderRadius: "8px",
                        background: "#0ea5e9",
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      {isSubmittingMarks ? "Saving Grades..." : "Save Student Marks"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </TeacherShell>
  );
}
