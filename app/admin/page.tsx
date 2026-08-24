"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Counts = {
  students: number;
  teachers: number;
  departments: number;
  courses: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({
    students: 0,
    teachers: 0,
    departments: 0,
    courses: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const meResponse = await fetch("/api/auth/me");
      if (!meResponse.ok) {
        router.replace("/login");
        return;
      }

      const me = await meResponse.json();
      if (me.user.role !== "ADMIN") {
        router.replace(me.user.role === "TEACHER" ? "/teacher/attendance" : "/");
        return;
      }

      const responses = await Promise.all([
        fetch("/api/students"),
        fetch("/api/teachers"),
        fetch("/api/departments"),
        fetch("/api/courses"),
      ]);

      if (responses.some((response) => !response.ok)) {
        setError("Unable to load dashboard data");
        return;
      }

      const [students, teachers, departments, courses] = await Promise.all(
        responses.map((response) => response.json()),
      );
      setCounts({
        students: students.students.length,
        teachers: teachers.teachers.length,
        departments: departments.departments.length,
        courses: courses.courses.length,
      });
    }

    loadDashboard().catch(() => setError("Unable to reach the server"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>College overview</h1>
        </div>
        <button className="quiet-button" type="button" onClick={logout}>Sign out</button>
      </header>

      {error && <p className="banner error-banner" role="alert">{error}</p>}

      <section className="admin-grid" aria-label="College records">
        <article className="metric-card"><span>Students</span><strong>{counts.students}</strong></article>
        <article className="metric-card"><span>Teachers</span><strong>{counts.teachers}</strong></article>
        <article className="metric-card"><span>Departments</span><strong>{counts.departments}</strong></article>
        <article className="metric-card"><span>Courses</span><strong>{counts.courses}</strong></article>
      </section>

      <section className="admin-links">
        <div>
          <p className="eyebrow">Management</p>
          <h2>Continue setup</h2>
        </div>
        <nav className="admin-nav">
          <a href="/admin/setup">Create academic records</a>
          <a href="/admin/teaching">Classes and enrollment</a>
          <a href="/admin/people">Create teachers and students</a>
          <a href="/admin/announcements">Publish announcements</a>
          <a href="/admin/people">Student records</a>
          <a href="/admin/people">Teacher records</a>
          <a href="/admin/setup">Departments</a>
          <a href="/admin/setup">Courses</a>
        </nav>
      </section>
    </main>
  );
}
