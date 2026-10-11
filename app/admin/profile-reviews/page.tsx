import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approveProfileForm,
  rejectProfileForm,
} from "@/app/actions/profile-review";

/**
 * Human-readable labels for the self-service profile fields that can appear in
 * `pendingProfileData`. Raw id/type columns are intentionally omitted from the
 * DISPLAY_KEYS allowlist below — their canonical *Name counterparts carry the
 * readable value, so showing both would just be noise for the reviewer.
 */
const PROFILE_FIELD_LABELS: Record<string, string> = {
  bloodGroup: "Blood Group",
  phone: "Phone",
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
  permTole: "Permanent Tole / Street",
  currProvinceName: "Current Province",
  currDistrictName: "Current District",
  currLocalLevelName: "Current Municipality",
  currLocalLevelType: "Current Municipality Type",
  currWard: "Current Ward",
  currTole: "Current Tole / Street",
  currSameAsPerm: "Current = Permanent",
};

/** Keys worth rendering in the diff table (skip raw ids / technical fields). */
const DISPLAY_KEYS = [
  "bloodGroup",
  "phone",
  "emergencyContact",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelation",
  "permProvinceName",
  "permDistrictName",
  "permLocalLevelName",
  "permWard",
  "permTole",
  "currSameAsPerm",
  "currProvinceName",
  "currDistrictName",
  "currLocalLevelName",
  "currWard",
  "currTole",
] as const;

/** Format a single pending value for display. */
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "currSameAsPerm") return value ? "Yes" : "No";
  return String(value);
}

type DiffRow = { key: string; label: string; from: string; to: string };

/**
 * Build the readable "current → new" rows for a pending profile-data blob.
 * `current` is the student's live row (same field names); `pending` holds only
 * the changed fields.
 */
function buildDiff(
  pending: Record<string, unknown>,
  current: Record<string, unknown>,
): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const key of DISPLAY_KEYS) {
    if (!(key in pending)) continue;
    const from = formatValue(key, current[key] ?? null);
    const to = formatValue(key, pending[key]);
    // Only surface fields whose value actually changed — the staged payload can
    // include no-op keys (e.g. currSameAsPerm is always sent), and showing an
    // unchanged "X → X" row is just noise for the reviewer.
    if (from === to) continue;
    rows.push({ key, label: PROFILE_FIELD_LABELS[key] ?? key, from, to });
  }
  return rows;
}

/**
 * Admin dashboard for the second verification step: every user whose profile
 * changes (picture and/or self-service fields such as permanent address and
 * guardian info) are awaiting review. Each card shows the current values vs.
 * the pending submission side by side.
 *
 * Server component — data is fetched per-request and each card's buttons are
 * plain forms bound to the approve/reject Server Actions (which revalidate
 * this path, so the card disappears on success).
 */
export default async function ProfileReviewsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const pending = await prisma.user.findMany({
    where: { profileReviewStatus: "PENDING_REVIEW" },
    include: {
      student: {
        select: {
          enrollmentNumber: true,
          profileImageUrl: true,
          program: { select: { code: true } },
          bloodGroup: true,
          phone: true,
          emergencyContact: true,
          guardianName: true,
          guardianPhone: true,
          guardianEmail: true,
          guardianRelation: true,
          currSameAsPerm: true,
          permProvinceName: true,
          permDistrictName: true,
          permLocalLevelName: true,
          permLocalLevelType: true,
          permWard: true,
          permTole: true,
          currProvinceName: true,
          currDistrictName: true,
          currLocalLevelName: true,
          currLocalLevelType: true,
          currWard: true,
          currTole: true,
        },
      },
      teacher: { select: { employeeNo: true, profileImageUrl: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  return (
    <AdminShell
      title="Profile Reviews"
      subtitle="Approve or reject submitted profile changes"
      active="/admin/profile-reviews"
    >
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No profile changes are waiting for review.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pending.map((u) => {
            const name = `${u.firstName} ${u.lastName}`;
            const currentAvatar =
              u.student?.profileImageUrl ?? u.teacher?.profileImageUrl ?? null;
            const roleBadge = u.student
              ? `Student · ${u.student.program?.code ?? "—"} · ${u.student.enrollmentNumber}`
              : u.teacher
                ? `Faculty · ${u.teacher.employeeNo}`
                : u.role;

            const pendingData = (u.pendingProfileData ?? {}) as Record<string, unknown>;
            const hasPendingData = Object.keys(pendingData).length > 0;
            const diff = u.student
              ? buildDiff(pendingData, u.student as unknown as Record<string, unknown>)
              : [];

            return (
              <Card key={u.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    {name}
                    <Badge variant="secondary">{roleBadge}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <p className="m-0 text-xs text-muted-foreground">{u.email}</p>

                  {u.pendingAvatarUrl && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Profile Picture
                      </h4>
                      <div className="flex items-center justify-center gap-6">
                        <figure className="m-0 grid justify-items-center gap-1.5">
                          {currentAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={currentAvatar}
                              alt={`${name} current avatar`}
                              className="size-24 rounded-xl border object-cover opacity-70"
                            />
                          ) : (
                            <span className="flex size-24 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                              None yet
                            </span>
                          )}
                          <figcaption className="text-xs text-muted-foreground">
                            Current
                          </figcaption>
                        </figure>
                        <figure className="m-0 grid justify-items-center gap-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u.pendingAvatarUrl}
                            alt={`${name} pending avatar`}
                            className="size-24 rounded-xl border object-cover"
                          />
                          <figcaption className="text-xs font-medium">
                            Pending
                          </figcaption>
                        </figure>
                      </div>
                    </div>
                  )}

                  {hasPendingData && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Profile Details
                      </h4>
                      {diff.length > 0 ? (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="py-1 font-medium">Field</th>
                              <th className="py-1 font-medium">Current</th>
                              <th className="py-1 font-medium">New</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.map((r) => (
                              <tr key={r.key} className="border-t align-top">
                                <td className="py-1 pr-2 font-medium">{r.label}</td>
                                <td className="py-1 pr-2 text-muted-foreground line-through">
                                  {r.from}
                                </td>
                                <td className="py-1">{r.to}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="m-0 text-xs text-muted-foreground">
                          Changes are pending but no displayable fields differ.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <form action={rejectProfileForm}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Reject
                      </Button>
                    </form>
                    <form action={approveProfileForm}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
