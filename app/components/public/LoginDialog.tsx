"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/app/components/common/Logo";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconAlertCircle,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onForgotPassword: (currentEmail: string) => void;
}

export function LoginDialog({
  open,
  onOpenChange,
  onForgotPassword,
}: LoginDialogProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      onOpenChange(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-[420px] border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl rounded-3xl gap-0">
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-border/50 bg-linear-to-b from-primary/10 via-primary/5 to-transparent">
          <DialogHeader className="items-center text-center space-y-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25 shadow-xs">
              <Logo className="size-7" />
            </span>

            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">
                Sign In
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter your university credentials to access your portal.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <div className="p-6">
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-semibold text-foreground">
                Email
              </Label>
              <div className="relative">
                <IconMail
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@fwu.edu.np"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 rounded-xl bg-muted/30 border-border/80 pl-10 text-xs sm:text-sm focus-visible:ring-primary/40 shadow-xs"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                Password
              </Label>

              <div className="relative">
                <IconLock
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 rounded-xl bg-muted/30 border-border/80 pr-10 pl-10 text-xs sm:text-sm focus-visible:ring-primary/40 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {/* Actions Row Below Password: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground select-none">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  disabled={loading}
                  className="rounded-md"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => onForgotPassword(email)}
                disabled={loading}
                className="text-xs font-medium text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive animate-fadeIn">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full h-11 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <IconArrowRight size={15} />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Security Footer */}
        <div className="px-6 py-3 bg-muted/30 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <IconShieldCheck size={13} className="text-emerald-500" />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <span className="font-medium text-[10px] uppercase tracking-wider">Far Western University</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
