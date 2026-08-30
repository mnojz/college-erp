"use client";

import { useCallback, useEffect, useState } from "react";
import { ProfileShell } from "@/app/components/profile/ProfileShell";
import { ProfileView } from "@/app/components/profile/ProfileView";
import { PrivacyPanel } from "@/app/components/profile/PrivacyPanel";
import {
  profileFieldsForRole,
  type FieldVisibility,
  type ProfileResponse,
} from "@/app/lib/profile-shared";

export default function MyProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to load your profile");
        }
        return res.json();
      })
      .then((result: ProfileResponse) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setVisibility = useCallback(
    async (fieldKey: string, visibility: FieldVisibility) => {
      if (!data?.settings) return;
      const previous = data.settings[fieldKey];
      if (previous === visibility) return;

      // Optimistic update, rolled back if the server rejects the change.
      setData({ ...data, settings: { ...data.settings, [fieldKey]: visibility } });
      setSavingKey(fieldKey);
      setError("");
      try {
        const res = await fetch("/api/profile/privacy", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: { [fieldKey]: visibility } }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to update privacy");
        }
        const result = (await res.json()) as { settings: Record<string, FieldVisibility> };
        setData((current) => (current ? { ...current, settings: result.settings } : current));
      } catch (err) {
        setData((current) =>
          current
            ? { ...current, settings: { ...current.settings, [fieldKey]: previous } }
            : current,
        );
        setError(err instanceof Error ? err.message : "Unable to update privacy");
      } finally {
        setSavingKey(null);
      }
    },
    [data],
  );

  const fields = data && data.profile.summary.role !== "ADMIN"
    ? profileFieldsForRole(data.profile.summary.role)
    : [];

  return (
    <ProfileShell activeHref="/profile" title="My profile" subtitle="Control what others can see">
      {error && (
        <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>
          {error}
        </p>
      )}
      {data ? (
        <>
          <ProfileView profile={data.profile} settings={data.settings} />
          {data.settings && (
            <PrivacyPanel
              fields={fields}
              settings={data.settings}
              onChange={setVisibility}
              savingKey={savingKey}
            />
          )}
        </>
      ) : (
        !error && <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</p>
      )}
    </ProfileShell>
  );
}