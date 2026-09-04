// ─── Profile privacy: shared contract ─────────────────────────────
// Single source of truth for which profile fields exist, how their
// visibility is controlled, and who may see RESTRICTED fields. This file is
// imported by both server (masking) and client (privacy UI) code, so it must
// never import server-only modules.
//
//  Privacy model
//  ─────────────
//  · USER-controlled field → the owner picks PUBLIC or PRIVATE. Choices are
//    stored in the ProfilePrivacy table; an absent row = defaultVisibility.
//  · RESTRICTED field → the owner can never publish it, even by accident.
//    Visibility is role policy: only roles listed in restrictedViewers may
//    see it. The owner and admins always see everything.

export type RoleName = "ADMIN" | "TEACHER" | "STUDENT";

export type FieldVisibility = "PUBLIC" | "PRIVATE";

export type ProfileFieldControl = "USER" | "RESTRICTED";

export type ProfileSectionId = "academic" | "faculty" | "personal" | "contact" | "guardian";

export type ProfileFieldDef = {
  key: string;
  label: string;
  section: ProfileSectionId;
  control: ProfileFieldControl;
  /** Default for USER-controlled fields when the owner has not chosen one. */
  defaultVisibility: FieldVisibility;
  /** Roles that may see a RESTRICTED field (ignored for USER fields). */
  restrictedViewers: RoleName[];
};

const EVERYONE: RoleName[] = ["ADMIN", "TEACHER", "STUDENT"];
const FACULTY_AND_ADMIN: RoleName[] = ["ADMIN", "TEACHER"];

export const PROFILE_SECTIONS: { id: ProfileSectionId; title: string }[] = [
  { id: "academic", title: "Academic information" },
  { id: "faculty", title: "Faculty details" },
  { id: "personal", title: "Personal information" },
  { id: "contact", title: "Contact details" },
  { id: "guardian", title: "Family / guardian" },
];

const SECTION_TITLES = Object.fromEntries(
  PROFILE_SECTIONS.map((section) => [section.id, section.title]),
) as Record<ProfileSectionId, string>;

export function profileSectionTitle(id: ProfileSectionId): string {
  return SECTION_TITLES[id];
}

/** Student profile fields. Enrollment data is institution-owned. */
export const STUDENT_PROFILE_FIELDS: ProfileFieldDef[] = [
  // Academic — RESTRICTED: role policy decides, never publishable by the student.
  { key: "programName",             label: "Program",           section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: EVERYONE },
  { key: "currentSemester",         label: "Current semester",  section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: EVERYONE },
  { key: "enrollmentNumber",        label: "Enrollment no.",    section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "registrationId",          label: "Registration ID",   section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "rollNumber",              label: "Roll number",       section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "admissionDate",           label: "Admission date",    section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "status", label: "Student status", section: "academic", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  // Personal — sensitive attributes are institution-controlled.
  { key: "gender",      label: "Gender",      section: "personal", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "bloodGroup",  label: "Blood group", section: "personal", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "nationality", label: "Nationality", section: "personal", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "religion",    label: "Religion",    section: "personal", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "category",    label: "Category",    section: "personal", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: ["ADMIN"] },
  // Contact — owner decides.
  { key: "phone",            label: "Phone",             section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "email",            label: "Email",             section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "permProvinceName", label: "Permanent address", section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "currProvinceName", label: "Current address",   section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "emergencyContact", label: "Emergency contact", section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  // Family / guardian — names are optional to share; guardian contact
  // details are institution-controlled.
  { key: "fatherName",       label: "Father's name",     section: "guardian", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "motherName",       label: "Mother's name",     section: "guardian", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "guardianRelation", label: "Guardian relation", section: "guardian", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "guardianPhone",    label: "Guardian phone",    section: "guardian", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "guardianEmail",    label: "Guardian email",    section: "guardian", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
];

/** Teacher profile fields. */
export const TEACHER_PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: "employeeNo",     label: "Employee no.",    section: "faculty", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: FACULTY_AND_ADMIN },
  { key: "subjectsTaught", label: "Subjects taught", section: "faculty", control: "RESTRICTED", defaultVisibility: "PRIVATE", restrictedViewers: EVERYONE },
  { key: "qualification",  label: "Qualification",   section: "faculty", control: "USER", defaultVisibility: "PUBLIC", restrictedViewers: [] },
  { key: "bio",            label: "About",           section: "faculty", control: "USER", defaultVisibility: "PUBLIC", restrictedViewers: [] },
  { key: "phone",          label: "Phone",           section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "email",          label: "Email",           section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
  { key: "office",         label: "Office / cabin",  section: "contact", control: "USER", defaultVisibility: "PRIVATE", restrictedViewers: [] },
];

export function profileFieldsForRole(role: RoleName): ProfileFieldDef[] {
  if (role === "STUDENT") return STUDENT_PROFILE_FIELDS;
  if (role === "TEACHER") return TEACHER_PROFILE_FIELDS;
  return []; // admin accounts have no role-specific profile fields
}

/** USER-controlled field keys for a role — the only keys a PATCH may touch. */
export function userControlledKeysForRole(role: RoleName): string[] {
  return profileFieldsForRole(role)
    .filter((field) => field.control === "USER")
    .map((field) => field.key);
}

/** Defaults for every USER-controlled field of a role. */
export function defaultSettingsForRole(role: RoleName): Record<string, FieldVisibility> {
  const settings: Record<string, FieldVisibility> = {};
  for (const field of profileFieldsForRole(role)) {
    if (field.control === "USER") settings[field.key] = field.defaultVisibility;
  }
  return settings;
}

// ─── Wire format (server → client) ────────────────────────────────

export type ProfileFieldPayload = {
  key: string;
  label: string;
  value: string;
  control: ProfileFieldControl;
};

export type ProfileSectionPayload = {
  id: ProfileSectionId;
  title: string;
  fields: ProfileFieldPayload[];
};

export type ProfileSummary = {
  id: string;
  name: string;
  role: RoleName;
  subtitle: string | null;
  photoUrl: string | null;
  /** Portal access flag (ACTIVE — can sign in, INACTIVE — sign-in blocked). */
  accountStatus: "ACTIVE" | "INACTIVE" | null;
};

export type ProfilePayload = {
  summary: ProfileSummary;
  isSelf: boolean;
  viewerIsAdmin: boolean;
  sections: ProfileSectionPayload[];
};

export type ProfileResponse = {
  profile: ProfilePayload;
  /** Present for self/admin views: effective visibility per USER-controlled field. */
  settings?: Record<string, FieldVisibility>;
};

export type DirectoryEntry = {
  id: string;
  name: string;
  role: RoleName;
  subtitle: string | null;
  photoUrl: string | null;
};

// ─── Pure formatting helpers ──────────────────────────────────────

export function formatProfileDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "ENROLLED" → "Enrolled" */
export function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}