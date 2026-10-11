"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ForgotPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled with whatever was typed into the login form. */
  initialEmail?: string;
  /** Closes this dialog and reopens the sign-in dialog. */
  onBackToSignIn: () => void;
};

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Two-step forgot-password popup: request a code by email, then verify it.
 * On a successful verification the server generates and emails a random
 * 8-character password — this dialog only reports that outcome.
 *
 * Mount this component conditionally (e.g. `{open && <ForgotPasswordDialog/>}`
 * driven by parent state) so every open starts fresh from the props; the
 * parent unmounts it on close.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialEmail,
  onBackToSignIn,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend countdown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to send the code");
        return;
      }
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Invalid or expired verification code");
        return;
      }
      setStep("done");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader className="items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl leading-normal font-bold tracking-tight">
            {step === "email" && "Reset your password"}
            {step === "code" && "Enter verification code"}
            {step === "done" && "Check your email"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" &&
              "Enter your registered email and we'll send you a 6-digit verification code."}
            {step === "code" &&
              `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
            {step === "done" &&
              `A new 8-character password has been emailed to ${email}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={requestOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgot-email" className="text-sm text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="forgot-email"
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
                  <Loader2 className="size-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                "Send verification code"
              )}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgot-otp" className="text-sm text-foreground">
                Verification code
              </Label>
              <Input
                id="forgot-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                disabled={loading}
                className="h-12 bg-card text-center font-mono text-lg tracking-[0.4em] shadow-sm"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="h-10 w-full text-sm font-semibold shadow-sm"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Verify & generate password"
              )}
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                disabled={loading}
                className="inline-flex items-center gap-1 font-medium hover:text-foreground disabled:opacity-50"
              >
                <ArrowLeft className="size-3" aria-hidden="true" />
                Change email
              </button>
              <button
                type="button"
                onClick={() => requestOtp()}
                disabled={loading || cooldown > 0}
                className="font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Sign in with your email and the new password, then change it as
              soon as you can. It may take a minute to arrive — also check your
              spam folder.
            </p>
            <Button
              type="button"
              size="lg"
              className="h-10 w-full text-sm font-semibold shadow-sm"
              onClick={onBackToSignIn}
            >
              Back to sign in
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

