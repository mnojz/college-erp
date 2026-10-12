/**
 * Tiny module-level cache for the logged-in user's shell identity
 * (name / employee id / avatar). The shape is intentionally `unknown` because
 * each role's profile endpoint returns a different body — callers cast to their
 * own type.
 *
 * Purpose: on a repeat visit the navbar/hero can render the real name & avatar
 * instantly (no "Faculty Member" flash, no shell layout shift) while the page's
 * own content still fetches fresh. Content is NEVER served from this cache — it
 * only holds the identity fields the shell displays, so there is no stale-data
 * risk for anything meaningful.
 *
 * Cleared on sign-out (see DashboardNav) so a different user never sees it.
 */

type ShellIdentity = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
  /** Optional pre-derived nav subtitle (e.g. "ID: 42" / "Emp ID: T-7"). */
  subtitle?: string;
};

const cache = new Map<string, ShellIdentity>();

export function readShellIdentity(key: string): ShellIdentity | null {
  return cache.get(key) ?? null;
}

export function writeShellIdentity(key: string, value: ShellIdentity): void {
  cache.set(key, value);
}

export function clearProfileCache(): void {
  cache.clear();
}
