"use client";

import { IconLock } from "@tabler/icons-react";
import type { FieldVisibility, ProfileFieldDef } from "@/app/lib/profile-shared";

const toggleStyle = (active: boolean) =>
  ({
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid var(--line-strong)",
    background: active ? "var(--accent-dark)" : "transparent",
    color: active ? "#ffffff" : "var(--ink-soft)",
  }) as const;

/**
 * Per-field privacy controls for the owner's own profile. USER-controlled
 * fields get a Public/Private toggle; RESTRICTED fields are listed as
 * read-only chips — the institution decides their visibility, always.
 */
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
    <section className="profile-info-card" style={{ marginTop: 20 }}>
      <h2>Privacy settings</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-soft)" }}>
        Choose which details other members can see on your profile. Locked details are
        institution-controlled and can never be made public. Administrators can always view
        every field.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {userFields.map((field) => {
          const visibility = settings[field.key] ?? field.defaultVisibility;
          const busy = savingKey === field.key;
          return (
            <div
              key={field.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600 }}>
                {field.label}
              </span>
              <button
                type="button"
                onClick={() => onChange(field.key, "PUBLIC")}
                disabled={busy || visibility === "PUBLIC"}
                aria-pressed={visibility === "PUBLIC"}
                style={toggleStyle(visibility === "PUBLIC")}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => onChange(field.key, "PRIVATE")}
                disabled={busy || visibility === "PRIVATE"}
                aria-pressed={visibility === "PRIVATE"}
                style={toggleStyle(visibility === "PRIVATE")}
              >
                Private
              </button>
            </div>
          );
        })}

        {restrictedFields.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                margin: "0 0 8px",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-soft)",
              }}
            >
              <IconLock size={13} aria-hidden="true" /> Locked by the institution
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {restrictedFields.map((field) => (
                <span
                  key={field.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px dashed var(--line-strong)",
                    color: "var(--ink-soft)",
                  }}
                >
                  <IconLock size={11} aria-hidden="true" /> {field.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}