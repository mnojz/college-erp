"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AssetIcon, studentAssets } from "@/app/components/student/assets";

const links = [["Overview", "/admin", studentAssets.academic], ["Programs", "/admin/setup", studentAssets.subjects], ["Subjects & classes", "/admin/teaching", studentAssets.schedules], ["People", "/admin/people", studentAssets.user], ["Announcements", "/admin/announcements", studentAssets.bell]] as const;
function getTheme() { if (typeof window === "undefined") return "light" as const; const saved = window.localStorage.getItem("college-erp-theme"); return saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" as const : "light" as const; }
function subscribe(onChange: () => void) { window.addEventListener("college-erp-theme-change", onChange); return () => window.removeEventListener("college-erp-theme-change", onChange); }

export function AdminShell({ title, subtitle, active, children }: { title: string; subtitle: string; active: string; children: React.ReactNode }) {
  const router = useRouter();
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  function changeTheme(next: "light" | "dark") { window.localStorage.setItem("college-erp-theme", next); window.dispatchEvent(new Event("college-erp-theme-change")); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/"); }
  return <div className="student-app-shell admin-app-shell"><header className="student-nav"><div className="student-brand"><span className="student-brand-mark"><AssetIcon src={studentAssets.graduationCap} size={22} /></span><span><strong>College-ERP</strong><small>Administration</small></span></div><div className="student-nav-actions"><div className="theme-switch" aria-label="Theme options"><button className={theme === "light" ? "selected" : ""} type="button" onClick={() => changeTheme("light")} aria-label="Use light theme"><AssetIcon src={studentAssets.sun} size={14} /></button><button className={theme === "dark" ? "selected" : ""} type="button" onClick={() => changeTheme("dark")} aria-label="Use dark theme"><AssetIcon src={studentAssets.moon} size={14} /></button></div><button className="student-user-trigger" type="button" onClick={logout}><span><strong>Administrator</strong><small>Sign out</small></span><img src={studentAssets.avatar} alt="" width={32} height={32} /></button></div></header><div className="student-page-body"><aside className="student-sidebar"><nav>{links.map(([label, href, icon]) => <Link key={href} className={`student-sidebar-link ${active === href ? "active" : ""}`} href={href}><AssetIcon src={icon} size={19} /><span>{label}</span>{active === href && <i />}</Link>)}</nav><div className="student-support"><strong>College administration</strong><p>Set up academic records and manage accounts from one workspace.</p><a href="/admin">Dashboard</a></div></aside><main className="admin-profile-content"><header className="admin-page-heading"><p>{subtitle}</p><h1>{title}</h1></header>{children}</main></div></div>;
}
