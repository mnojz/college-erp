"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconHandMove,
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";

export type ProfileImagePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string | null;
  name: string;
  subtitle?: string;
  badge?: string;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;

function ProfileImagePreviewContent({
  imageUrl,
  name,
  subtitle = "Profile Photo Preview",
  badge,
}: Omit<ProfileImagePreviewModalProps, "open" | "onOpenChange">) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(MAX_ZOOM, +(prev + ZOOM_STEP).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, +(prev - ZOOM_STEP).toFixed(2));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Wheel to zoom in / out
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!imageUrl) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2)));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Pointer drag to pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageUrl || e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if capture already lost
      }
    }
  };

  // Double click to toggle 1x and 2x zoom
  const handleDoubleClick = () => {
    if (!imageUrl) return;
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  return (
    <DialogContent
      className="p-0 gap-0 overflow-hidden w-[90vw] sm:max-w-md md:max-w-lg lg:max-w-xl border-border/80 shadow-2xl rounded-2xl bg-card"
      showCloseButton={true}
    >
      {/* Header */}
      <DialogHeader className="p-3.5 sm:p-4 border-b border-border/70 bg-card select-none">
        <div className="flex items-center justify-between pr-8">
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base font-bold text-foreground truncate">
              {name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {subtitle}
            </DialogDescription>
          </div>
          {badge && (
            <Badge className="text-[11px] font-semibold border-0 bg-primary/15 text-primary shrink-0">
              {badge}
            </Badge>
          )}
        </div>
      </DialogHeader>

      {/* Viewport / Interactive Canvas */}
      <div
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={`relative flex items-center justify-center overflow-hidden h-[42vh] sm:h-[48vh] md:h-[52vh] bg-muted/20 select-none touch-none ${
          imageUrl
            ? isDragging
              ? "cursor-grabbing"
              : zoom > 1
              ? "cursor-grab"
              : "cursor-grab"
            : ""
        }`}
        title={imageUrl ? "Double-click to toggle zoom · Drag to pan" : undefined}
      >
        {imageUrl ? (
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="relative max-h-full max-w-full flex items-center justify-center will-change-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              draggable={false}
              className="max-h-[36vh] sm:max-h-[42vh] md:max-h-[46vh] w-auto max-w-[80vw] object-contain rounded-xl shadow-md border border-border/50 select-none pointer-events-none"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="size-24 sm:size-28 rounded-2xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center text-3xl font-black text-primary-foreground shadow-md mb-2.5">
              {initials}
            </div>
            <p className="text-sm font-semibold text-foreground">No Custom Photo Uploaded</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              An institutional avatar is currently displayed for this account.
            </p>
          </div>
        )}

        {/* Floating Quick Reset Pill (appears when zoomed or panned) */}
        {imageUrl && (zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <div className="absolute top-3 left-3 z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="h-6 px-2 text-[11px] font-medium rounded-full bg-background/80 backdrop-blur-md border border-border/70 shadow-xs hover:bg-background gap-1 text-foreground"
            >
              <IconRefresh className="size-3 text-muted-foreground" />
              Reset View
            </Button>
          </div>
        )}
      </div>

      {/* Footer Toolbar with Zoom & Pan Controls */}
      {imageUrl && (
        <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 border-t border-border/70 bg-card flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
          {/* Helpful Interaction Hints */}
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground text-[11px]">
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <IconHandMove className="size-3 text-primary" />
              Drag to pan
            </span>
            <span>•</span>
            <span>Scroll to zoom</span>
            <span>•</span>
            <span>Double-click to toggle</span>
          </div>

          {/* Interactive Control Pill */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70 ml-auto shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
              title="Zoom Out (-25%)"
              aria-label="Zoom Out"
            >
              <IconZoomOut className="size-4" />
            </Button>

            <span className="w-12 text-center font-mono text-xs font-semibold tabular-nums text-foreground">
              {Math.round(zoom * 100)}%
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
              title="Zoom In (+25%)"
              aria-label="Zoom In"
            >
              <IconZoomIn className="size-4" />
            </Button>

            <div className="h-4 w-px bg-border/80 mx-0.5" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-background gap-1"
              title="Reset Zoom & Pan"
              aria-label="Reset Zoom & Pan"
            >
              <IconRefresh className="size-3.5" />
              <span className="hidden xs:inline">Reset</span>
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}

export function ProfileImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  name,
  subtitle,
  badge,
}: ProfileImagePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ProfileImagePreviewContent
          key={`${name}-${imageUrl}`}
          imageUrl={imageUrl}
          name={name}
          subtitle={subtitle}
          badge={badge}
        />
      ) : null}
    </Dialog>
  );
}
