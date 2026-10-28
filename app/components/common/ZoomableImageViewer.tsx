"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  IconExternalLink,
  IconRefresh,
  IconRotateClockwise,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.25;

export type ZoomableImageViewerProps = {
  src: string;
  alt: string;
  openUrl?: string;
  className?: string;
  fillParent?: boolean;
};

export function ZoomableImageViewer({
  src,
  alt,
  openUrl,
  className,
  fillParent = false,
}: ZoomableImageViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Keep panRef in sync with pan state
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
    setRotation(0);
  }, []);

  // Reset viewport when source changes
  useEffect(() => {
    resetView();
  }, [src, resetView]);

  // Cancel any animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const zoomIn = () => {
    setZoom((prev) => Math.min(MAX_ZOOM, +(prev + ZOOM_STEP).toFixed(2)));
  };

  const zoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, +(prev - ZOOM_STEP).toFixed(2));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
        panRef.current = { x: 0, y: 0 };
      }
      return next;
    });
  };

  const rotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  // Double-click toggles between 1x and 2x zoom smoothly
  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      resetView();
    }
  };

  // Wheel zooming via non-passive listener to avoid preventDefault console issues and layout thrashing
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Distinguish discrete physical mouse wheel click from continuous touchpad pinch/scroll
      const isPinch = e.ctrlKey;
      const isWheelClick =
        !isPinch &&
        (e.deltaMode === 1 ||
          (e.deltaMode === 0 &&
            Math.abs(e.deltaY) >= 50 &&
            Number.isInteger(e.deltaY) &&
            Math.abs(e.deltaY) % 10 === 0));

      let delta: number;
      if (isWheelClick) {
        // Physical mouse wheel step: standard step
        delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      } else {
        // Touchpad pinch or continuous two-finger swipe: dampened sensitivity
        const factor = isPinch ? 0.008 : 0.002;
        delta = -e.deltaY * factor;
        // Cap single frame change to prevent jumpiness on aggressive trackpad flings
        delta = Math.max(-0.15, Math.min(0.15, delta));
      }

      setZoom((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2)));
        if (next <= 1 && prev > 1) {
          setPan({ x: 0, y: 0 });
          panRef.current = { x: 0, y: 0 };
        }
        return next;
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Pointer drag to pan (mouse, touch, pen) with PointerCapture for fluid tracking
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const nextX = e.clientX - dragStartRef.current.x;
    const nextY = e.clientY - dragStartRef.current.y;
    panRef.current = { x: nextX, y: nextY };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setPan({ x: nextX, y: nextY });
      rafIdRef.current = null;
    });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setPan(panRef.current);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if capture already lost
      }
    }
  };

  // Keyboard navigation & shortcuts
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = 40;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomIn();
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomOut();
    } else if (e.key === "0" || e.key === "Escape") {
      e.preventDefault();
      resetView();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      rotate();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = { x: panRef.current.x + step, y: panRef.current.y };
      panRef.current = next;
      setPan(next);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = { x: panRef.current.x - step, y: panRef.current.y };
      panRef.current = next;
      setPan(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = { x: panRef.current.x, y: panRef.current.y + step };
      panRef.current = next;
      setPan(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = { x: panRef.current.x, y: panRef.current.y - step };
      panRef.current = next;
      setPan(next);
    }
  };

  const isChanged = zoom !== 1 || pan.x !== 0 || pan.y !== 0 || rotation !== 0;

  return (
    <div className={cn("relative flex w-full", fillParent ? "size-full h-full min-h-0 flex-1" : "h-72 sm:h-96 md:h-110", className)}>
      {/* Viewport / Interactive Canvas */}
      <div
        ref={stageRef}
        className={cn(
          "relative flex size-full min-h-0 touch-none items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        role="application"
        aria-label={`Zoomable preview of ${alt}. Use the plus, minus, and arrow keys to zoom and pan.`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Hardware-accelerated image container */}
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="relative max-h-full max-w-full flex items-center justify-center will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- attachment streamed by our own API */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={resetView}
            className="max-h-full max-w-full object-contain select-none pointer-events-none rounded-sm shadow-xs"
          />
        </div>

        {/* Floating Quick Reset Pill (appears when zoomed, panned, or rotated) */}
        {isChanged && (
          <div className="absolute top-3 left-3 z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={resetView}
              className="h-7 px-2.5 text-xs font-medium rounded-full bg-background/90 backdrop-blur-md border-0 shadow-md hover:bg-background gap-1.5 text-foreground"
            >
              <IconRefresh size={13} className="text-muted-foreground" aria-hidden="true" />
              <span>Reset View</span>
            </Button>
          </div>
        )}

        {/* Floating Controls Overlay at Bottom Center */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2 py-1 rounded-full shadow-lg border-0 text-foreground select-none">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
            title="Zoom out (-25%)"
            aria-label="Zoom out"
          >
            <IconZoomOut size={16} aria-hidden="true" />
          </Button>

          <span
            className="w-12 text-center font-mono text-xs font-semibold tabular-nums text-foreground select-none"
            aria-live="polite"
          >
            {Math.round(zoom * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
            title="Zoom in (+25%)"
            aria-label="Zoom in"
          >
            <IconZoomIn size={16} aria-hidden="true" />
          </Button>

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={rotate}
            className="size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
            title="Rotate clockwise (90°)"
            aria-label="Rotate clockwise"
          >
            <IconRotateClockwise size={15} aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetView}
            disabled={!isChanged}
            className="h-7 px-2 text-xs rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1"
            title="Reset zoom, pan, and rotation"
            aria-label="Reset view"
          >
            <IconRefresh size={14} aria-hidden="true" />
            <span className="hidden xs:inline">Reset</span>
          </Button>

          {openUrl && (
            <>
              <div className="h-4 w-px bg-border/60 mx-0.5" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                asChild
                className="size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
                title="Open full size in a new tab"
                aria-label="Open full size"
              >
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconExternalLink size={15} aria-hidden="true" />
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
