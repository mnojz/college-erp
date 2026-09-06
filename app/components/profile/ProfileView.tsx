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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_BADGES: Record<RoleName, { label: string; className: string }> = {
  STUDENT: { label: "Student", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  TEACHER: { label: "Faculty", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  ADMIN: { label: "Admin", className: "bg-red-500/10 text-red-700 dark:text-red-300" },
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
        className="shrink-0 text-muted-foreground"
        aria-label="Visibility managed by the institution"
      />
    );
  }
  const visibility = settings?.[field.key];
  if (!visibility) return null;
  return visibility === "PUBLIC" ? (
    <IconEye size={12} className="shrink-0 text-emerald-600" aria-label="Public" />
  ) : (
    <IconEyeOff size={12} className="shrink-0 text-muted-foreground" aria-label="Private" />
  );
}

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
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={profile.summary.name} photoUrl={profile.summary.photoUrl} size={64} />
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-lg font-semibold">{profile.summary.name}</strong>
              <Badge className={badge.className}>{badge.label}</Badge>
              {profile.isSelf && (
                <Badge
                  variant="outline"
                  className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  This is you
                </Badge>
              )}
              {profile.summary.accountStatus === "INACTIVE" && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            {profile.summary.subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">{profile.summary.subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      </Card>

      {profile.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shared profile information to display.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profile.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-sm">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[minmax(120px,1.2fr)_1fr] gap-x-4 gap-y-2.5 text-sm">
                  {section.fields.map((field) => (
                    <FragmentRow
                      key={field.key}
                      field={field}
                      showBadges={showBadges}
                      settings={settings}
                    />
                  ))}
                </dl>
              </CardContent>
            </Card>
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
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {field.label}
        {showBadges && <VisibilityBadge field={field} settings={settings} />}
      </dt>
      <dd className="font-medium break-words">{field.value}</dd>
    </div>
  );
}
