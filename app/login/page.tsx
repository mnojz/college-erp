"use client";

import { useEffect } from "react";
import { PublicLayout, usePublicLayout } from "@/app/components/layout/PublicLayout";

/** Opens the modal after the provider is mounted. */
function LoginModalOpener() {
  const { openLogin } = usePublicLayout();
  useEffect(() => {
    const t = setTimeout(openLogin, 0);
    return () => clearTimeout(t);
  }, [openLogin]);
  return null;
}

/**
 * Dedicated /login route target (used by middleware redirects when an
 * unauthenticated user hits a protected route). It opens the sign-in modal
 * that lives inside PublicLayout. After a successful sign-in the modal
 * redirects the user to their role-specific dashboard.
 */
export default function LoginPage() {
  return (
    <PublicLayout>
      <LoginModalOpener />
    </PublicLayout>
  );
}

