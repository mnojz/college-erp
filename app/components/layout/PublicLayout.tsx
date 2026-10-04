"use client";

import Link from "next/link";
import { useState, FormEvent, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/app/components/common/Logo";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { PublicNavbar } from "./PublicNavbar";
import { useTheme } from "@/app/lib/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PublicLayoutContextValue = {
  openLogin: () => void;
};

const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(null);

export function usePublicLayout(): PublicLayoutContextValue {
  const ctx = useContext(PublicLayoutContext);
  if (!ctx) {
    throw new Error("usePublicLayout must be used within <PublicLayout>");
  }
  return ctx;
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useTheme(); // ensure theme initialized

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function openLogin() {
    setShowLoginModal(true);
    setError("");
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Invalid email or password");
        return;
      }
      setShowLoginModal(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  }

  return (
    <PublicLayoutContext.Provider value={{ openLogin }}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicNavbar onSignInClick={openLogin} />

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
            <div className="flex items-center gap-2.5">
              <Logo className="size-7 text-foreground" />
              <div className="leading-tight">
                <strong className="block text-sm font-semibold">College-ERP</strong>
                <span className="text-xs text-muted-foreground">Far Western University</span>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" aria-label="Footer">
              <Link href="/public/course-structure" className="text-muted-foreground transition-colors hover:text-foreground">
                Curriculum
              </Link>
              <Link href="/public/fee-structure" className="text-muted-foreground transition-colors hover:text-foreground">
                Fees
              </Link>
              <Link href="/public/syllabus" className="text-muted-foreground transition-colors hover:text-foreground">
                Syllabus
              </Link>
              <Link href="/public/notices" className="text-muted-foreground transition-colors hover:text-foreground">
                Notices
              </Link>
            </nav>
          </div>
        </footer>

        {/* Login dialog */}
        <Dialog open={showLoginModal} onOpenChange={(open) => !open && setShowLoginModal(false)}>
          <DialogContent className="gap-5 p-6 sm:max-w-md">
            <DialogHeader className="items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Logo className="size-7" />
              </span>
              <DialogTitle className="text-xl leading-normal font-bold tracking-tight">
                Welcome back
              </DialogTitle>
              <DialogDescription>
                Sign in to access your student, faculty, or administration dashboard.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@fwu.edu.np"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-10 bg-card pl-10 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-sm text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-10 bg-card pr-10 pl-10 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  disabled={loading}
                />
                Remember me
              </label>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-10 w-full text-sm font-semibold shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="flex flex-col gap-3 border-t pt-5">
              <div className="relative text-center">
                <span className="relative z-10 bg-popover px-2 text-xs font-medium tracking-wide text-muted-foreground">
                  Or use a demo account
                </span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Student", email: "student@fwu.edu.np", pass: "student1234" },
                  { label: "Teacher", email: "teacher@fwu.edu.np", pass: "teacher1234" },
                  { label: "Admin", email: "admin@fwu.edu.np", pass: "admin1234" },
                ].map((demo) => (
                  <Button
                    key={demo.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => fillDemo(demo.email, demo.pass)}
                    className="h-9 w-full"
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Credentials are pre-filled — just press Sign In.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PublicLayoutContext.Provider>
  );
}
