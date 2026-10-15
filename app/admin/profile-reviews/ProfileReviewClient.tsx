"use client";

import { useState, useTransition } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconFileDescription,
  IconHistory,
  IconInbox,
  IconPhoto,
  IconSearch,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
  IconUserX,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { approveProfileChanges, rejectProfileChanges } from "@/app/actions/profile-review";
import { cn } from "cn";

const PROFILE_FIELD_LABELS: Record<string, string> = {
  gender: "Gender",
  nationality: "Nationality",
  religion: "Religion",
  category: "Category / Caste",
  bloodGroup: "Blood Group",
  phone: "Primary Phone",
  emergencyContact: "Emergency Contact",
  guardianName: "Guardian Name",
  guardianPhone: "Guardian Phone",
  guardianEmail: "Guardian Email",
  guardianRelation: "Guardian Relation",
  permProvinceName: "Permanent Province",
  permDistrictName: "Permanent District",
  permLocalLevelName: "Permanent Municipality",
  permLocalLevelType: "Permanent Municipality Type",
  permWard: "Permanent Ward",
  permTole: "Permanent Street / Tole",
  currProvinceName: "Current Province",
  currDistrictName: "Current District",
  currLocalLevelName: "Current Municipality",
  currLocalLevelType: "Current Municipality Type",
  currWard: "Current Ward",
  currTole: "Current Street / Tole",
  currSameAsPerm: "Current Same as Permanent",
};

const DISPLAY_KEYS = [
  "gender",
  "nationality",
  "religion",
  "category",
  "bloodGroup",
  "phone",
  "emergencyContact",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelation",
  "currSameAsPerm",
  "permProvinceName",
  "permDistrictName",
  "permLocalLevelName",
  "permWard",
  "permTole",
  "currProvinceName",
  "currDistrictName",
  "currLocalLevelName",
  "currWard",
  "currTole",
] as const;

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "currSameAsPerm") return value ? "Yes" : "No";
  return String(value);
}

export type DiffRow = { key: string; label: string; from: string; to: string };

function buildDiff(
  pending: Record<string, unknown>,
  current: Record<string, unknown>,
): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const key of DISPLAY_KEYS) {
    if (!(key in pending)) continue;
    const from = formatValue(key, current[key] ?? null);
    const to = formatValue(key, pending[key]);
    if (from === to) continue;
    rows.push({ key, label: PROFILE_FIELD_LABELS[key] ?? key, from, to });
  }
  return rows;
}

export type PendingUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  updatedAt: string;
  pendingAvatarUrl: string | null;
  pendingProfileData: Record<string, unknown> | null;
  student: {
    enrollmentNumber: string;
    profileImageUrl: string | null;
    program: { code: string; name: string } | null;
    [key: string]: unknown;
  } | null;
  teacher: {
    employeeNo: string;
    profileImageUrl: string | null;
  } | null;
};

export type HistoryItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    student: {
      enrollmentNumber: string;
      profileImageUrl: string | null;
      program: { code: string; name: string } | null;
    } | null;
    teacher: {
      employeeNo: string;
      profileImageUrl: string | null;
    } | null;
  } | null;
};

export function ProfileReviewClient({
  initialPending,
  initialHistory,
}: {
  initialPending: PendingUser[];
  initialHistory: HistoryItem[];
}) {
  const [pending, setPending] = useState<PendingUser[]>(initialPending);
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "APPROVED" | "REJECTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [rejectDialogUser, setRejectDialogUser] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [approveDialogUser, setApproveDialogUser] = useState<PendingUser | null>(null);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState("");

  const handleApprove = (user: PendingUser) => {
    setActionError("");
    startTransition(async () => {
      const res = await approveProfileChanges(user.id, approveNote || undefined);
      if (!res.ok) {
        setActionError(res.error || "Failed to approve profile changes.");
        return;
      }
      setPending((prev) => prev.filter((p) => p.id !== user.id));
      const newHistoryItem: HistoryItem = {
        id: `local-${Date.now()}`,
        type: "PROFILE_APPROVED",
        title: user.pendingAvatarUrl && user.pendingProfileData ? "Profile photo & details approved" : user.pendingAvatarUrl ? "Profile photo approved" : "Profile details approved",
        body: approveNote ? `Approved with note: ${approveNote}` : "Approved by administrator. Changes are now live.",
        createdAt: new Date().toISOString(),
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          student: user.student,
          teacher: user.teacher,
        },
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
      setApproveDialogUser(null);
      setApproveNote("");
    });
  };

  const handleReject = () => {
    if (!rejectDialogUser) return;
    setActionError("");
    startTransition(async () => {
      const res = await rejectProfileChanges(rejectDialogUser.id, rejectReason || undefined);
      if (!res.ok) {
        setActionError(res.error || "Failed to reject profile changes.");
        return;
      }
      setPending((prev) => prev.filter((p) => p.id !== rejectDialogUser.id));
      const newHistoryItem: HistoryItem = {
        id: `local-${Date.now()}`,
        type: "PROFILE_REJECTED",
        title: rejectDialogUser.pendingAvatarUrl && rejectDialogUser.pendingProfileData ? "Profile photo & details rejected" : rejectDialogUser.pendingAvatarUrl ? "Profile photo rejected" : "Profile details rejected",
        body: rejectReason ? `Rejected. Reason: ${rejectReason}` : "Profile submission was rejected by administrator.",
        createdAt: new Date().toISOString(),
        user: {
          id: rejectDialogUser.id,
          firstName: rejectDialogUser.firstName,
          lastName: rejectDialogUser.lastName,
          email: rejectDialogUser.email,
          role: rejectDialogUser.role,
          student: rejectDialogUser.student,
          teacher: rejectDialogUser.teacher,
        },
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
      setRejectDialogUser(null);
      setRejectReason("");
    });
  };

  const filteredHistory = history.filter((item) => {
    if (historyFilter === "APPROVED" && item.type !== "PROFILE_APPROVED") return false;
    if (historyFilter === "REJECTED" && item.type !== "PROFILE_REJECTED") return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = `${item.user?.firstName ?? ""} ${item.user?.lastName ?? ""}`.toLowerCase();
    const email = (item.user?.email ?? "").toLowerCase();
    const enroll = (item.user?.student?.enrollmentNumber ?? "").toLowerCase();
    const program = (item.user?.student?.program?.code ?? "").toLowerCase();
    const body = item.body.toLowerCase();

    return (
      name.includes(query) ||
      email.includes(query) ||
      enroll.includes(query) ||
      program.includes(query) ||
      body.includes(query)
    );
  });

  const approvedCount = history.filter((h) => h.type === "PROFILE_APPROVED").length;
  const rejectedCount = history.filter((h) => h.type === "PROFILE_REJECTED").length;

  return (
    <div className="space-y-6">
      {actionError && (
        <div
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
          role="alert"
        >
          <IconAlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top Metric Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Pending Queue</span>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-bold",
                pending.length > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <IconInbox size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {pending.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {pending.length === 1 ? "1 request awaiting review" : `${pending.length} requests awaiting review`}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Processed</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
              <IconHistory size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {history.length}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Historical decisions recorded</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Approved</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <IconCheck size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {approvedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Live changes accepted</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Rejected</span>
            <span className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold">
              <IconX size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {rejectedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Submissions returned</p>
        </div>
      </section>

      {/* Primary Tabs: Pending vs History */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "pending" | "history")}
        className="space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="pending" className="gap-2 text-xs font-semibold">
              <IconUserCheck size={14} />
              <span>Pending Verification</span>
              {pending.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-xs font-semibold">
              <IconHistory size={14} />
              <span>Review History &amp; Logs</span>
              <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                {history.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {activeTab === "history" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <IconSearch
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Filter logs by name, roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs">
                {(["ALL", "APPROVED", "REJECTED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize",
                      historyFilter === filter
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {filter === "ALL" ? "All Logs" : filter.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TAB 1: PENDING QUEUE ── */}
        <TabsContent value="pending" className="m-0 focus-visible:outline-hidden">
          {pending.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-border/80 bg-card/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                  <IconInbox size={26} />
                </span>
                <h3 className="text-base font-bold text-foreground">All caught up — Queue is clean</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  There are no pending profile verification requests right now. New student photo
                  uploads or profile changes will appear here automatically.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("history")}
                  className="mt-4 gap-1.5 text-xs font-semibold"
                >
                  <IconHistory size={14} />
                  <span>View Review History</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {pending.map((u) => {
                const name = `${u.firstName} ${u.lastName}`;
                const currentAvatar =
                  u.student?.profileImageUrl ?? u.teacher?.profileImageUrl ?? null;
                const roleBadge = u.student
                  ? `Student · ${u.student.program?.code ?? "General"} · ${u.student.enrollmentNumber}`
                  : u.teacher
                    ? `Teacher · ${u.teacher.employeeNo}`
                    : u.role;

                const pendingData = (u.pendingProfileData ?? {}) as Record<string, unknown>;
                const hasPendingData = Object.keys(pendingData).length > 0;
                const diff = u.student
                  ? buildDiff(pendingData, u.student as unknown as Record<string, unknown>)
                  : [];

                return (
                  <Card
                    key={u.id}
                    className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs transition-shadow hover:shadow-sm"
                  >
                    {/* Header */}
                    <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                            {u.firstName[0]}
                            {u.lastName[0]}
                          </span>
                          <div>
                            <h3 className="text-base font-bold text-foreground">{name}</h3>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs font-semibold bg-card">
                            {roleBadge}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent"
                          >
                            Awaiting Review
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-6">
                      {/* Photo Comparison Section */}
                      {u.pendingAvatarUrl && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <IconPhoto size={16} className="text-primary" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Profile Picture Comparison
                            </h4>
                          </div>

                          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto sm:mx-0">
                            {/* Current Avatar */}
                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-muted/20 gap-2">
                              {currentAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={currentAvatar}
                                  alt="Current avatar"
                                  className="size-24 rounded-lg object-cover border border-border/80 shadow-2xs opacity-75"
                                />
                              ) : (
                                <div className="size-24 rounded-lg border border-dashed border-border/80 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                                  <IconUser size={24} />
                                  <span className="text-[10px] mt-1">No Photo</span>
                                </div>
                              )}
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                Current Live Photo
                              </span>
                            </div>

                            {/* Proposed Avatar */}
                            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-primary/40 bg-primary/5 gap-2 relative">
                              <span className="absolute top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground uppercase tracking-wide">
                                New
                              </span>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u.pendingAvatarUrl}
                                alt="Proposed avatar"
                                className="size-24 rounded-lg object-cover border-2 border-primary shadow-xs ring-2 ring-primary/20"
                              />
                              <span className="text-[11px] font-bold text-primary">
                                Proposed Upload
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Details Diff Section */}
                      {hasPendingData && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <IconFileDescription size={16} className="text-emerald-500" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Requested Profile Information Updates
                            </h4>
                          </div>

                          {diff.length > 0 ? (
                            <div className="rounded-xl border border-border/70 overflow-hidden">
                              <div className="grid grid-cols-3 bg-muted/50 p-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                <div>Field</div>
                                <div>Current Value</div>
                                <div className="text-primary">Updated Submission</div>
                              </div>
                              <div className="divide-y divide-border/50 text-xs">
                                {diff.map((r) => (
                                  <div
                                    key={r.key}
                                    className="grid grid-cols-3 p-2.5 items-center hover:bg-muted/20 transition-colors"
                                  >
                                    <div className="font-semibold text-foreground">{r.label}</div>
                                    <div className="text-muted-foreground line-through pr-2 truncate">
                                      {r.from}
                                    </div>
                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block w-fit">
                                      {r.to}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Submission received, but no visible differences from live record.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/50">
                        <span className="text-[11px] text-muted-foreground">
                          Reviewing will immediately notify the student and update their official
                          record.
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              setRejectDialogUser(u);
                              setRejectReason("");
                            }}
                            className="gap-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 font-semibold"
                          >
                            <IconX size={14} />
                            <span>Reject</span>
                          </Button>

                          <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              setApproveDialogUser(u);
                              setApproveNote("");
                            }}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
                          >
                            <IconCheck size={14} />
                            <span>Approve Changes</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: REVIEW HISTORY & LOGS ── */}
        <TabsContent value="history" className="m-0 focus-visible:outline-hidden">
          {filteredHistory.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-border/80 bg-card/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                  <IconHistory size={26} />
                </span>
                <h3 className="text-base font-bold text-foreground">No Review Logs Found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {searchQuery
                    ? "No audit records matched your search query. Try clearing the search."
                    : "When you approve or reject student profile changes, the detailed audit history will appear here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const isApproved = item.type === "PROFILE_APPROVED";
                const user = item.user;
                const name = user ? `${user.firstName} ${user.lastName}` : "Unknown User";
                const roleBadge = user?.student
                  ? `Student · ${user.student.program?.code ?? "—"} · ${user.student.enrollmentNumber}`
                  : user?.teacher
                    ? `Teacher · ${user.teacher.employeeNo}`
                    : user?.role ?? "User";

                return (
                  <Card
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-card p-4 shadow-xs hover:border-border transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: User & Avatar */}
                      <div className="flex items-center gap-3 min-w-0">
                        {user?.student?.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.student.profileImageUrl}
                            alt={name}
                            className="size-10 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full text-xs font-bold shrink-0",
                              isApproved
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {name[0]}
                          </span>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-foreground truncate">{name}</p>
                            <Badge variant="outline" className="text-[10px] font-semibold bg-muted/40 shrink-0">
                              {roleBadge}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>

                      {/* Right: Decision Badge & Timestamp */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 text-[11px] font-bold px-2 py-0.5 uppercase tracking-wide border-transparent",
                            isApproved
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {isApproved ? <IconCheck size={12} /> : <IconX size={12} />}
                          <span>{isApproved ? "Approved" : "Rejected"}</span>
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <IconClock size={11} />
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Review Note / Message */}
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground font-semibold shrink-0">Details:</span>
                        <p className="text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground">{item.title}. </span>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODAL: REJECT CONFIRMATION ── */}
      <Dialog
        open={!!rejectDialogUser}
        onOpenChange={(open) => !open && setRejectDialogUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <IconUserX size={18} />
              Reject Profile Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rejecting will discard all proposed updates for{" "}
              <strong className="text-foreground">
                {rejectDialogUser?.firstName} {rejectDialogUser?.lastName}
              </strong>
              . Their previous official profile data will remain untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              Reason for rejection (Optional)
            </label>
            <Textarea
              placeholder="e.g. Photo is blurry, address documentation incomplete, incorrect phone format..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              This reason will be recorded in the audit history and delivered to the student in their
              notification.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogUser(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={isPending}
              className="gap-1.5 font-semibold"
            >
              <IconX size={14} />
              <span>Confirm Rejection</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: APPROVE CONFIRMATION ── */}
      <Dialog
        open={!!approveDialogUser}
        onOpenChange={(open) => !open && setApproveDialogUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <IconShieldCheck size={18} />
              Approve Profile Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Approving will apply all proposed changes directly to the live official record for{" "}
              <strong className="text-foreground">
                {approveDialogUser?.firstName} {approveDialogUser?.lastName}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              Approval Note (Optional)
            </label>
            <Input
              placeholder="e.g. Verified with admissions office"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Recorded in the institutional audit log for reference.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveDialogUser(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => approveDialogUser && handleApprove(approveDialogUser)}
              disabled={isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <IconCheck size={14} />
              <span>Confirm &amp; Apply</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
