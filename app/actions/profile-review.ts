"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin, requireAuth } from "@/app/lib/auth";
import { allAdminUserIds, notifyUsers } from "@/app/lib/notify";
import { Prisma } from "@/app/generated/prisma/client";

/** ~512KB of image after base64 — matches ImageUploadCrop's JPEG 0.88 output. */
const MAX_DATA_URL_CHARS = 700_000;

/** Where admins review pending profile/avatar changes. */
const REVIEW_LINK = "/admin/profile-reviews";

/**
 * Notify every active admin that a profile change is awaiting review.
 * Fire-and-forget: a notification failure must never break the submit.
 */
async function notifyAdminsOfReview(title: string, body: string): Promise<void> {
  try {
    await notifyUsers(await allAdminUserIds(), {
      type: "profile_review",
      title,
      body,
      link: REVIEW_LINK,
    });
  } catch (err) {
    console.error("notifyAdminsOfReview:", err);
  }
}

/**
 * Profile review system (user-facing submit half).
 *
 * Stage a new profile PICTURE for admin review. The client has already run the
 * blur + face gates; the server enforces only what it can cheaply verify
 * (session, shape, size). Admin approval is the authoritative gate that makes
 * the picture live.
 *
 * Self-service profile *fields* (address, guardian, phone…) take a different
 * path — they are staged by `PATCH /api/student/profile` into
 * `pendingProfileData`. Both share the single `profileReviewStatus` flag, so a
 * user appears once in the admin queue regardless of what they changed.
 */
export async function submitAvatarForReview(
  dataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAuth();
  if (!session) return { ok: false, error: "Not signed in." };
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Invalid image payload." };
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    return { ok: false, error: "Image is too large — please use a smaller photo." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { pendingAvatarUrl: dataUrl, profileReviewStatus: "PENDING_REVIEW", lastAvatarRejectedAt: null },
  });
  revalidatePath("/student");
  revalidatePath("/teacher");

  const submitter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const who = submitter ? `${submitter.firstName} ${submitter.lastName}`.trim() : "A user";
  await notifyAdminsOfReview(
    "New profile picture to review",
    `${who} submitted a new profile picture for approval.`,
  );
  return { ok: true };
}

/**
 * Approve (admin): apply every pending change, then clear the staging columns
 * and flip the status to APPROVED.
 *   • pendingProfileData (a partial { Student column: value } map) is written
 *     onto the Student row.
 *   • pendingAvatarUrl is written through to the role-specific profileImageUrl.
 * A single notification tells the user what went live.
 */
export async function approveProfileChanges(
  userId: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Forbidden" };

  const [adminUser, user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: admin.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        pendingAvatarUrl: true,
        pendingProfileData: true,
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    }),
  ]);

  if (!user || (!user.pendingAvatarUrl && !user.pendingProfileData)) {
    return { ok: false, error: "Nothing pending for this user." };
  }

  const adminName = adminUser
    ? `${adminUser.firstName} ${adminUser.lastName}`.trim()
    : "Administrator";
  const hadAvatar = !!user.pendingAvatarUrl;
  const hadData = !!user.pendingProfileData;
  const scope = hadAvatar && hadData ? "photo & details" : hadAvatar ? "photo" : "details";
  const actionTitle = `Profile ${scope} approved`;
  const bodyText = note?.trim()
    ? `Approved by ${adminName}. Note: ${note.trim()}`
    : `Your submitted profile ${scope} have been verified and approved by ${adminName}. They are now live on your profile.`;

  const updates: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({
      where: { id: userId },
      data: {
        pendingAvatarUrl: null,
        pendingProfileData: Prisma.DbNull,
        profileReviewStatus: "APPROVED",
        // A picture approved now supersedes any earlier picture rejection.
        ...(user.pendingAvatarUrl ? { lastAvatarRejectedAt: null } : {}),
      },
    }),
  ];

  if (user.pendingProfileData && user.student) {
    // The blob only ever contains validated SELF_EDITABLE keys (see
    // PATCH /api/student/profile), so it is safe to apply as an update input.
    updates.push(
      prisma.student.update({
        where: { id: user.student.id },
        data: user.pendingProfileData as unknown as Prisma.StudentUpdateInput,
      }),
    );
  }

  if (user.pendingAvatarUrl) {
    if (user.student) {
      updates.push(
        prisma.student.update({
          where: { id: user.student.id },
          data: { profileImageUrl: user.pendingAvatarUrl },
        }),
      );
    }
    if (user.teacher) {
      updates.push(
        prisma.teacher.update({
          where: { id: user.teacher.id },
          data: { profileImageUrl: user.pendingAvatarUrl },
        }),
      );
    }
  }

  updates.push(
    prisma.notification.create({
      data: {
        userId,
        type: "PROFILE_APPROVED",
        title: actionTitle,
        body: bodyText,
        link: user.student ? "/student" : "/teacher",
      },
    }),
  );

  await prisma.$transaction(updates);

  revalidatePath("/admin/profile-reviews");
  revalidatePath("/admin/people");
  revalidatePath("/student");
  revalidatePath("/teacher");
  return { ok: true };
}

/**
 * Reject (admin): discard every pending change and set status to REJECTED.
 * The user's existing avatar and profile values are deliberately left intact —
 * rejecting never rolls anything back, it only drops what was awaiting review.
 */
export async function rejectProfileChanges(
  userId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Forbidden" };

  const [adminUser, user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: admin.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        pendingAvatarUrl: true,
        pendingProfileData: true,
        student: { select: { id: true } },
      },
    }),
  ]);

  if (!user || (!user.pendingAvatarUrl && !user.pendingProfileData)) {
    return { ok: false, error: "Nothing pending for this user." };
  }

  const adminName = adminUser
    ? `${adminUser.firstName} ${adminUser.lastName}`.trim()
    : "Administrator";
  const hadAvatar = !!user.pendingAvatarUrl;
  const hadData = !!user.pendingProfileData;
  const scope = hadAvatar && hadData ? "photo & details" : hadAvatar ? "photo" : "details";
  const actionTitle = `Profile ${scope} rejected`;
  const reasonText = reason?.trim()
    ? `Reason: ${reason.trim()}`
    : "The submitted update or photo did not meet college guidelines.";
  const bodyText = `Reviewed by ${adminName}. ${reasonText} Your previous profile details remain unchanged.`;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        pendingAvatarUrl: null,
        pendingProfileData: Prisma.DbNull,
        profileReviewStatus: "REJECTED",
        // Only flag the PICTURE as rejected when one was actually pending; a
        // data-only rejection must not surface as "photo rejected" in the UI.
        ...(user.pendingAvatarUrl ? { lastAvatarRejectedAt: new Date() } : {}),
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: "PROFILE_REJECTED",
        title: actionTitle,
        body: bodyText,
        link: user.student ? "/student" : "/teacher",
      },
    }),
  ]);

  revalidatePath("/admin/profile-reviews");
  return { ok: true };
}

/**
 * Thin FormData wrappers for <form action={…}> on the admin review page:
 * form actions must return void/Promise<void>, so the { ok, error } results
 * of the underlying actions are logged instead of returned.
 */
export async function approveProfileForm(formData: FormData): Promise<void> {
  const id = formData.get("userId");
  const note = formData.get("note");
  if (typeof id !== "string" || !id) return;
  const res = await approveProfileChanges(id, typeof note === "string" ? note : undefined);
  if (!res.ok) console.error("approveProfileChanges:", res.error);
}

export async function rejectProfileForm(formData: FormData): Promise<void> {
  const id = formData.get("userId");
  const reason = formData.get("reason");
  if (typeof id !== "string" || !id) return;
  const res = await rejectProfileChanges(id, typeof reason === "string" ? reason : undefined);
  if (!res.ok) console.error("rejectProfileChanges:", res.error);
}
