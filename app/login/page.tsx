"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to sign in");
        return;
      }

      const destination = result.user.role === "TEACHER"
        ? "/teacher/attendance"
        : result.user.role === "ADMIN"
          ? "/admin"
          : "/student";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <p className="eyebrow">College ERP</p>
        <h1>One clear place for the work of a college.</h1>
        <p className="intro-copy">
          Sign in to manage classes, attendance, student progress, and academic records.
        </p>
      </section>

      <section className="auth-panel" aria-labelledby="login-heading">
        <p className="eyebrow">Welcome back</p>
        <h2 id="login-heading">Sign in</h2>
        <p className="panel-copy">Use your college account to continue.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@college.edu"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
