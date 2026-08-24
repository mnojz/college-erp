"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  rollNumber: string | null;
  admissionNo: string;
  profileImageUrl: string | null;
  user: { firstName: string; lastName: string };
};

type Offering = {
  id: string;
  section: string;
  course: { code: string; name: string };
  term: { name: string; number: number; academicYear: { name: string } };
  enrollments: { student: Student }[];
};

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [heldAt, setHeldAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === selectedOfferingId),
    [offerings, selectedOfferingId],
  );

  useEffect(() => {
    async function loadOfferings() {
      const response = await fetch("/api/attendance");
      if (response.status === 403 || response.status === 401) {
        router.replace("/");
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to load classes");
        return;
      }
      setOfferings(result.offerings);
      setSelectedOfferingId(result.offerings[0]?.id ?? "");
      setIsLoading(false);
    }

    loadOfferings().catch(() => setError("Unable to reach the server"));
  }, [router]);

  function toggleStudent(studentId: string) {
    setPresentStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectOffering(offeringId: string) {
    setSelectedOfferingId(offeringId);
    setPresentStudentIds(new Set());
    setMessage("");
    setError("");
  }

  async function submitAttendance() {
    if (!selectedOffering) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeringId: selectedOffering.id,
          heldAt: new Date(heldAt).toISOString(),
          presentStudentIds: [...presentStudentIds],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to submit attendance");
        return;
      }
      setMessage(`Attendance saved: ${presentStudentIds.size} present, ${selectedOffering.enrollments.length - presentStudentIds.size} absent.`);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Teacher workspace</p>
          <h1>Take attendance</h1>
        </div>
        <button className="quiet-button" type="button" onClick={logout}>Sign out</button>
      </header>

      <section className="attendance-toolbar">
        <label>
          Class
          <select value={selectedOfferingId} onChange={(event) => selectOffering(event.target.value)} disabled={isLoading}>
            {offerings.length === 0 && <option value="">No assigned classes</option>}
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.course.code} · {offering.course.name} · Section {offering.section}
              </option>
            ))}
          </select>
        </label>
        <label>
          Class date and time
          <input type="datetime-local" value={heldAt} onChange={(event) => setHeldAt(event.target.value)} />
        </label>
        <div className="attendance-summary">
          <span>{selectedOffering?.term.academicYear.name ?? "Academic year"}</span>
          <strong>{selectedOffering?.enrollments.length ?? 0} students</strong>
        </div>
      </section>

      {error && <p className="banner error-banner" role="alert">{error}</p>}
      {message && <p className="banner success-banner" role="status">{message}</p>}

      <section className="roster-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Roll call</p>
            <h2>{selectedOffering ? `${selectedOffering.course.code} roster` : "Student roster"}</h2>
          </div>
          <p className="attendance-count">{presentStudentIds.size} of {selectedOffering?.enrollments.length ?? 0} present</p>
        </div>

        {isLoading ? (
          <p className="empty-state">Loading assigned classes...</p>
        ) : selectedOffering?.enrollments.length ? (
          <div className="roster-list">
            {selectedOffering.enrollments.map(({ student }) => {
              const isPresent = presentStudentIds.has(student.id);
              return (
                <label className={`student-row ${isPresent ? "is-present" : ""}`} key={student.id}>
                  <span className="roll-number">{student.rollNumber ?? student.admissionNo}</span>
                  {student.profileImageUrl ? (
                    <img className="student-avatar" src={student.profileImageUrl} alt="" />
                  ) : (
                    <span className="student-avatar avatar-fallback">{student.user.firstName[0]}{student.user.lastName[0]}</span>
                  )}
                  <span className="student-name">
                    <strong>{student.user.firstName} {student.user.lastName}</strong>
                    <small>{student.admissionNo}</small>
                  </span>
                  <span className="presence-label">{isPresent ? "Present" : "Absent"}</span>
                  <input type="checkbox" checked={isPresent} onChange={() => toggleStudent(student.id)} />
                </label>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">No enrolled students in this class yet.</p>
        )}
      </section>

      <footer className="submit-bar">
        <p>Students are marked absent unless checked present.</p>
        <button className="primary-button" type="button" onClick={submitAttendance} disabled={!selectedOffering || isSubmitting || !selectedOffering.enrollments.length}>
          {isSubmitting ? "Saving attendance..." : "Submit attendance"}
        </button>
      </footer>
    </main>
  );
}
