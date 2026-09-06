"use client";

import { IconLock } from "@tabler/icons-react";
import type { FieldVisibility, ProfileFieldDef } from "@/app/lib/profile-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function PrivacyPanel({
  fields,
  settings,
  onChange,
  savingKey,
}: {
  fields: ProfileFieldDef[];
  settings: Record<string, FieldVisibility>;
  onChange: (fieldKey: string, visibility: FieldVisibility) => void;
  savingKey: string | null;
}) {
  const userFields = fields.filter((field) => field.control === "USER");
  const restrictedFields = fields.filter((field) => field.control === "RESTRICTED");

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-base">Privacy settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which details other members can see on your profile. Locked details are
          institution-controlled and can never be made public. Administrators can always view
          every field.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {userFields.map((field) => {
          const visibility = settings[field.key] ?? field.defaultVisibility;
          const busy = savingKey === field.key;
          return (
            <div
              key={field.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <span className="min-w-36 flex-1 text-sm font-semibold">{field.label}</span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={visibility === "PUBLIC" ? "default" : "outline"}
                  disabled={busy || visibility === "PUBLIC"}
                  aria-pressed={visibility === "PUBLIC"}
                  onClick={() => onChange(field.key, "PUBLIC")}
                >
                  Public
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={visibility === "PRIVATE" ? "default" : "outline"}
                  disabled={busy || visibility === "PRIVATE"}
                  aria-pressed={visibility === "PRIVATE"}
                  onClick={() => onChange(field.key, "PRIVATE")}
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  Private
                </Button>
              </div>
            </div>
          );
        })}

        {restrictedFields.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <IconLock size={13} aria-hidden="true" /> Locked by the institution
            </p>
            <div className="flex flex-wrap gap-2">
              {restrictedFields.map((field) => (
                <Badge key={field.key} variant="outline" className="gap-1 border-dashed">
                  <IconLock size={11} aria-hidden="true" /> {field.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
