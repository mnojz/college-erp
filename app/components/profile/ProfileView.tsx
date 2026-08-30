"use client";

import type { ReactNode } from "react";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";
import { Avatar } from "@/app/components/profile/Avatar";
import type {
  FieldVisibility,
  ProfileFieldPayload,
  ProfilePayload,
  RoleName,
} from "@/app/lib/profile-shared";

const ROLE_BADGES: Record<RoleName, { label: string; background: string; color: string }> = {
  STUDENT: { label: "Student", background: "rgba(2,132,199,0.12)", color: "#0369a1" },
  TEACHER: { label: "Faculty", background: "rgba(16,185,129,0.14)", color: "#047857" },
  ADMIN: { label: "Admin", background: "rgba(239,68,68,0.12)", color: "#b91c1c" },
};

function VisibilityBadge({
  field,
  settings,
}: {
  field: ProfileFieldPayload;
  settings?: Record<string, FieldVisibility>;
}) {
  if (field.control === "RESTRICTED") {
    return (
      <IconLock
        size={12}
        style={{ color: "var(--ink-soft)", flexShrink: 0 }}
        aria-label="Visibility managed by the institution"
      />
    );
  }
  const visibility = settings?.[field.key];
  if (!visibility) return null;
  return visibility === "PUBLIC" ? (
    <IconEye size={12} style={{ color: "#047857", flexShrink: 0 }} aria-label="Public" />
  ) : (
    <IconEyeOff size={12} style={{ color: "var(--ink-soft)", flexShrink: 0 }} aria-label="Private" />
  );
}

/**
 * Renders a (server-masked) profile payload. Sections/fields that the viewer
 * may not see never arrive from the API, so this component simply draws what
 * it receives. Visibility icons are shown only when `settings` is provided
 * (own profile / admin audit view).
 */
export function ProfileView({
  profile,
  settings,
  actions,
}: {
  profile: ProfilePayload;
  settings?: Record<string, FieldVisibility>;
  actions?: ReactNode;
}) {
  const badge = ROLE_BADGES[profile.summary.role];
  const showBadges = settings !== undefined;

  return (
    <div>
      <section className="profile-info-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Avatar name={profile.summary.name} photoUrl={profile.summary.photoUrl} size={64} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 18 }}>{profile.summary.name}</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: badge.background,
                  color: badge.color,
                }}
              >
                {badge.label}
              </span>
              {profile.isSelf && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "var(--mint)",
                    color: "#047857",
                  }}
                >
                  This is you
                </span>
              )}
            </div>
            {profile.summary.subtitle && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                {profile.summary.subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      </section>

      {profile.sections.length === 0 ? (
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          No shared profile information to display.
        </p>
      ) : (
        <div className="profile-card-grid">
          {profile.sections.map((section) => (
            <section key={section.id} className="profile-info-card">
              <h2>{section.title}</h2>
              <dl>
                {section.fields.map((field) => (
                  <FragmentRow key={field.key} field={field} showBadges={showBadges} settings={settings} />
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  field,
  showBadges,
  settings,
}: {
  field: ProfileFieldPayload;
  showBadges: boolean;
  settings?: Record<string, FieldVisibility>;
}) {
  return (
    <div style={{ display: "contents" }}>
      <dt style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {field.label}
        {showBadges && <VisibilityBadge field={field} settings={settings} />}
      </dt>
      <dd style={{ wordBreak: "break-word" }}>{field.value}</dd>
    </div>
  );
}