"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProfileShell } from "@/app/components/profile/ProfileShell";
import { ProfileView } from "@/app/components/profile/ProfileView";
import type { ProfileResponse } from "@/app/lib/profile-shared";

/** View someone else's profile — the API already masked it for this viewer. */
export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  if (!userId) return null;
  // Keyed so navigating between profiles resets the loader's state cleanly.
  return (
    <ProfileShell key={userId} title="Profile" subtitle="Campus member">
      <ProfileLoader userId={userId} />
    </ProfileShell>
  );
}

function ProfileLoader({ userId }: { userId: string }) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${userId}/profile`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("Profile not found");
        if (!res.ok) throw new Error("Unable to load this profile");
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
  }, [userId]);

  if (error) {
    return <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>{error}</p>;
  }
  if (!data) {
    return <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</p>;
  }
  return <ProfileView profile={data.profile} />;
}