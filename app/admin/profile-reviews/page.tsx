import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { ProfileReviewClient } from "./ProfileReviewClient";

export default async function ProfileReviewsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const [pending, history] = await Promise.all([
    prisma.user.findMany({
      where: { profileReviewStatus: "PENDING_REVIEW" },
      include: {
        student: {
          select: {
            enrollmentNumber: true,
            profileImageUrl: true,
            program: { select: { code: true, name: true } },
            gender: true,
            nationality: true,
            religion: true,
            category: true,
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
    }),
    prisma.notification.findMany({
      where: {
        type: { in: ["PROFILE_APPROVED", "PROFILE_REJECTED"] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            student: {
              select: {
                enrollmentNumber: true,
                profileImageUrl: true,
                program: { select: { code: true, name: true } },
              },
            },
            teacher: {
              select: {
                employeeNo: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const serializedPending = pending.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    updatedAt: u.updatedAt.toISOString(),
    pendingAvatarUrl: u.pendingAvatarUrl,
    pendingProfileData: (u.pendingProfileData as Record<string, unknown>) ?? null,
    student: u.student,
    teacher: u.teacher,
  }));

  const serializedHistory = history.map((h) => ({
    id: h.id,
    type: h.type,
    title: h.title,
    body: h.body,
    createdAt: h.createdAt.toISOString(),
    user: h.user,
  }));

  return (
    <AdminShell
      title="Profile Reviews & Audit History"
      subtitle="Verify student profile updates and inspect previous review decisions"
      active="/admin/profile-reviews"
    >
      <ProfileReviewClient
        initialPending={serializedPending}
        initialHistory={serializedHistory}
      />
    </AdminShell>
  );
}
