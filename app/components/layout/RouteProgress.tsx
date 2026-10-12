"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin, glowing progress bar pinned to the top of the viewport. It advances
 * while the app navigates between routes (or swaps in-page tabs that change
 * the URL) and snaps to 100% the moment the new route settles, then fades.
 *
 * Start is detected three ways so nothing slips through: internal link clicks,
 * programmatic history.pushState/replaceState (router.push + `?tab=` swaps),
 * and a hard fallback timer. Completion is driven by the route actually
 * changing (pathname/searchParams).
 *
 * Fill + glow use the Catppuccin Blue accent (var(--ctp-blue)), which adapts
 * to the light (Latte) and dark (Mocha) palettes automatically.
 */

const ACCENT = "var(--ctp-blue, var(--primary))";
/** Ease toward this ceiling while loading; only hits 100% on completion. */
const CEILING = 92;

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const progressRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const prevRoute = useRef(routeKey);

  const prefersReduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function clearTimers() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    rafRef.current = null;
  }

  function tick() {
    const next = progressRef.current + (CEILING - progressRef.current) * 0.12;
    progressRef.current = Math.min(next, CEILING);
    setProgress(progressRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function start() {
    if (runningRef.current) return;
    runningRef.current = true;
    clearTimers();
    setDone(false);
    setVisible(true);
    if (prefersReduced()) {
      progressRef.current = 60;
      setProgress(60);
    } else {
      progressRef.current = 10;
      setProgress(10);
      rafRef.current = requestAnimationFrame(tick);
    }
    // Safety net: fade out even if a navigation never resolves.
    timersRef.current.push(setTimeout(() => finish(), 8000));
  }

  function finish() {
    if (!runningRef.current) return;
    runningRef.current = false;
    clearTimers();
    progressRef.current = 100;
    setProgress(100);
    setDone(true);
    timersRef.current.push(
      setTimeout(() => {
        setVisible(false);
        setDone(false);
        progressRef.current = 0;
        setProgress(0);
      }, prefersReduced() ? 120 : 320),
    );
  }

  const startRef = useRef(start);
  const finishRef = useRef(finish);
  useEffect(() => {
    startRef.current = start;
    finishRef.current = finish;
  });

  // Completion: the route key changed => the new page has settled.
  useEffect(() => {
    if (prevRoute.current !== routeKey) {
      prevRoute.current = routeKey;
      finishRef.current();
    }
  }, [routeKey]);

  // Start on internal link clicks (capture phase, before Next handles it).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel):/i.test(href)) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      startRef.current();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Start on programmatic navigation (router.push/replace + `?tab=` swaps).
  useEffect(() => {
    const patch = (fn: History["pushState"] | History["replaceState"]) =>
      function (this: History, ...args: Parameters<typeof fn>) {
        const result = fn.apply(this, args as never);
        try {
          const next = new URL(String(args[2] ?? ""), window.location.href);
          if (next.href !== window.location.href) startRef.current();
        } catch {
          /* malformed URL — ignore */
        }
        return result;
      } as typeof fn;
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = patch(origPush);
    history.replaceState = patch(origReplace);
    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  // Clean up everything on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      for (const t of timersRef.current) clearTimeout(t);
    },
    [],
  );

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden"
    >
      {/* Soft bloom behind the bar for the glow. */}
      <div
        className="absolute inset-y-0 left-0 h-full blur-[6px] transition-opacity duration-200"
        style={{
          width: `${progress}%`,
          opacity: done ? 0 : 0.55,
          background: `linear-gradient(to right, color-mix(in oklab, ${ACCENT} 55%, transparent), ${ACCENT})`,
        }}
      />
      {/* The bar itself, with its own glow shadow. */}
      <div
        className="absolute inset-y-0 left-0 h-full rounded-r-full"
        style={{
          width: `${progress}%`,
          opacity: done ? 0 : 1,
          background: `linear-gradient(to right, color-mix(in oklab, ${ACCENT} 70%, transparent), ${ACCENT})`,
          boxShadow: `0 0 6px ${ACCENT}, 0 0 14px color-mix(in oklab, ${ACCENT} 60%, transparent)`,
          transition: done ? "opacity 240ms ease" : undefined,
        }}
      />
    </div>
  );
}
