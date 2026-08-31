import type { Prisma } from "@/app/generated/prisma/client";
import type { Session } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  PROFILE_SECTIONS,
  defaultSettingsForRole,
  formatEnumLabel,
  formatProfileDate,
  profileFieldsForRole,
  profileSectionTitle,
  type FieldVisibility,
  type ProfileResponse,
  type ProfileSectionId,
  type ProfileSectionPayload,
  type RoleName,
} from "@/app/lib/profile-shared";

const PROFILE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  privacySettings: { select: { fieldKey: true, visibility: true } },
  student: {
    select: {
      profileImageUrl: true,
      enrollmentNumber: true,
      registrationId: true,
      rollNumber: true,
      currentSemester: true,
      admissionDate: true,
      status: true,
      gender: true,
      bloodGroup: true,
      nationality: true,
      religion: true,
      category: true,
      phone: true,
      currentAddress: true,
      permanentAddress: true,
      emergencyContact: true,
      fatherName: true,
      motherName: true,
      guardianPhone: true,
      guardianEmail: true,
      guardianRelation: true,
      program: { select: { name: true, code: true } },
    },
  },
  teacher: {
    select: {
      profileImageUrl: true,
      employeeNo: true,
      phone: true,
      office: true,
      qualification: true,
      bio: true,
      subjectTeachers: { select: { subject: { select: { name: true, code: true } } } },
    },
  },
} satisfies Prisma.UserSelect;

type ProfileTargetUser = Prisma.UserGetPayload<{ select: typeof PROFILE_USER_SELECT }>;

/**
 * Profile masking core. Loads the target user once, then resolves every
 * registry field against (viewer role, owner settings, field classification).
 * Only fields the viewer is allowed to see are ever placed in the response —
 * private data must not leave the server, so the client never filters.
 */
export async function getProfileForViewer(
  viewer: Session,
  targetUserId: string,
): Promise<ProfileResponse | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: PROFILE_USER_SELECT,
  });

  if (!target || target.status !== "ACTIVE") return null;

  const role = target.role as RoleName;
  const viewerIsAdmin = viewer.role === "ADMIN";
  const isSelf = viewer.userId === target.id;
  const canSeeEverything = isSelf || viewerIsAdmin;

  // Overrides stored by the owner (USER-controlled fields only).
  const overrides: Record<string, FieldVisibility> = {};
  for (const row of target.privacySettings) {
    overrides[row.fieldKey] = row.visibility as FieldVisibility;
  }

  const values = collectFieldValues(target, role);

  const sectionsById = new Map<ProfileSectionId, ProfileSectionPayload>();
  for (const field of profileFieldsForRole(role)) {
    // 1) Decide visibility for this viewer.
    let visible = canSeeEverything;
    if (!visible) {
      if (field.control === "RESTRICTED") {
        visible = field.restrictedViewers.includes(viewer.role as RoleName);
      } else {
        visible = (overrides[field.key] ?? field.defaultVisibility) === "PUBLIC";
      }
    }
    if (!visible) continue;

    // 2) Only surface fields that actually have a value.
    const value = values[field.key];
    if (value === null || value === "") continue;

    let section = sectionsById.get(field.section);
    if (!section) {
      section = { id: field.section, title: profileSectionTitle(field.section), fields: [] };
      sectionsById.set(field.section, section);
    }
    section.fields.push({ key: field.key, label: field.label, value, control: field.control });
  }

  const sections = PROFILE_SECTIONS.map(({ id }) => sectionsById.get(id)).filter(
    (section): section is ProfileSectionPayload => section !== undefined,
  );

  const profile: ProfileResponse["profile"] = {
    summary: {
      id: target.id,
      name: `${target.firstName} ${target.lastName}`.trim(),
      role,
      subtitle: subtitleFor(target, role),
      photoUrl: target.student?.profileImageUrl ?? target.teacher?.profileImageUrl ?? null,
    },
    isSelf,
    viewerIsAdmin,
    sections,
  };

  return {
    profile,
    // Effective settings for the owner (and admins auditing someone's config).
    settings:
      canSeeEverything && role !== "ADMIN"
        ? { ...defaultSettingsForRole(role), ...overrides }
        : undefined,
  };
}

function subtitleFor(target: ProfileTargetUser, role: RoleName): string | null {
  if (role === "STUDENT" && target.student) {
    const parts: string[] = [];
    if (target.student.program) parts.push(target.student.program.name);
    if (target.student.currentSemester) parts.push(`Semester ${target.student.currentSemester}`);
    return parts.length > 0 ? parts.join(" · ") : "Student";
  }
  if (role === "TEACHER") return "Faculty member";
  return "Administrator";
}

function collectFieldValues(
  target: ProfileTargetUser,
  role: RoleName,
): Record<string, string | null> {
  const values: Record<string, string | null> = {};

  if (role === "STUDENT" && target.student) {
    const s = target.student;
    values.programName = s.program ? `${s.program.name} (${s.program.code})` : null;
    values.currentSemester = s.currentSemester ? `Semester ${s.currentSemester}` : null;
    values.enrollmentNumber = s.enrollmentNumber;
    values.registrationId = s.registrationId;
    values.rollNumber = s.rollNumber;
    values.admissionDate = s.admissionDate ? formatProfileDate(s.admissionDate) : null;
    values.status = s.status
      ? formatEnumLabel(s.status)
      : null;
    values.gender = s.gender;
    values.bloodGroup = s.bloodGroup;
    values.nationality = s.nationality;
    values.religion = s.religion;
    values.category = s.category;
    values.phone = s.phone;
    values.email = target.email;
    values.currentAddress = s.currentAddress;
    values.permanentAddress = s.permanentAddress;
    values.emergencyContact = s.emergencyContact;
    values.fatherName = s.fatherName;
    values.motherName = s.motherName;
    values.guardianRelation = s.guardianRelation;
    values.guardianPhone = s.guardianPhone;
    values.guardianEmail = s.guardianEmail;
  }

  if (role === "TEACHER" && target.teacher) {
    const t = target.teacher;
    const subjectNames = [...new Set(t.subjectTeachers.map((st) => st.subject.name))].sort();
    values.employeeNo = t.employeeNo;
    values.subjectsTaught = subjectNames.length > 0 ? subjectNames.join(", ") : null;
    values.qualification = t.qualification;
    values.bio = t.bio;
    values.phone = t.phone;
    values.email = target.email;
    values.office = t.office;
  }

  return values;
}