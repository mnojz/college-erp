"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "cn";

/**
 * Global programmatic helpers to trigger and finish the top progress bar
 * from anywhere in the app (e.g. during page data fetches).
 */
export function startProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:progress:start"));
  }
}

export function doneProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:progress:done"));
  }
}

/**
 * Top Progress Bar:
 * - Listens for link clicks, history state transitions (router.push/replace),
 *   and custom `app:progress:start` / `app:progress:done` events.
 * - Simulates realistic progress trickle (NProgress algorithm) moving from
 *   20% to ~88% while loading, then smoothly snapping to 100% and fading.
 * - Retains a minimum visible duration (350ms) so fast transitions do not
 *   flicker for 1 frame and vanish prematurely.
 * - Glowing leading edge with vibrant primary gradient.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  const runningRef = useRef(false);
  const progressRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const prevRouteKey = useRef(routeKey);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    startTimeRef.current = Date.now();
    clearTimer();
    setFading(false);
    setVisible(true);

    // Initial jump
    progressRef.current = 22;
    setProgress(22);

    // Realistic trickle animation
    timerRef.current = setInterval(() => {
      const current = progressRef.current;
      let increment = 0;
      if (current < 50) {
        increment = 4 + Math.random() * 6;
      } else if (current < 75) {
        increment = 2 + Math.random() * 3;
      } else if (current < 88) {
        increment = 0.5 + Math.random() * 1.2;
      } else {
        // Hold near ceiling until completion
        increment = 0.1;
      }

      const next = Math.min(current + increment, 92);
      progressRef.current = next;
      setProgress(next);
    }, 200);
  }, [clearTimer]);

  const finish = useCallback(() => {
    if (!runningRef.current) return;
    clearTimer();

    // Ensure the progress bar was visible for at least 250ms to prevent 1-frame flashes
    const elapsed = Date.now() - startTimeRef.current;
    const minHold = 250;
    const delay = Math.max(0, minHold - elapsed);

    setTimeout(() => {
      progressRef.current = 100;
      setProgress(100);

      // Begin fade out after showing 100%
      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          setFading(false);
          runningRef.current = false;
          progressRef.current = 0;
          setProgress(0);
        }, 250);
      }, 150);
    }, delay);
  }, [clearTimer]);

  // Route change detection: finish progress when the route key settles
  useEffect(() => {
    if (prevRouteKey.current !== routeKey) {
      prevRouteKey.current = routeKey;
      if (runningRef.current) {
        finish();
      }
    }
  }, [routeKey, finish]);

  // Global event listeners for manual start / finish
  useEffect(() => {
    const handleStart = () => start();
    const handleDone = () => finish();

    window.addEventListener("app:progress:start", handleStart);
    window.addEventListener("app:progress:done", handleDone);

    return () => {
      window.removeEventListener("app:progress:start", handleStart);
      window.removeEventListener("app:progress:done", handleDone);
    };
  }, [start, finish]);

  // Listen for internal link clicks (capture phase before Next.js routing starts)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

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
      ) {
        return;
      }

      start();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // Intercept programmatic history navigation (router.push / router.replace)
  useEffect(() => {
    const patch = (fn: History["pushState"] | History["replaceState"]) =>
      function (this: History, ...args: Parameters<typeof fn>) {
        const result = fn.apply(this, args as never);
        try {
          const next = new URL(String(args[2] ?? ""), window.location.href);
          if (next.href !== window.location.href) {
            start();
          }
        } catch {
          // ignore malformed URLs
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
  }, [start]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[99999] h-[3px] overflow-hidden transition-opacity duration-200",
        fading ? "opacity-0" : "opacity-100",
      )}
    >
      {/* Background track */}
      <div className="absolute inset-0 bg-primary/10" />

      {/* Glowing progress line */}
      <div
        className="relative h-full transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background:
            "linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, #6366f1 100%)",
          boxShadow: "0 0 10px rgba(59, 130, 246, 0.7), 0 0 5px rgba(6, 182, 212, 0.5)",
        }}
      >
        {/* Pulsing leading head glow */}
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent to-white/60 blur-[2px]" />
      </div>
    </div>
  );
}
