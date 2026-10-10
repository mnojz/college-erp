"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconRefresh, IconZoomIn, IconZoomOut, IconCheck } from "@tabler/icons-react";
import {
  clampPan,
  drawCropPreview,
  exportSquareCrop,
  type CropTransform,
} from "@/app/lib/crop";

const VIEW = 288; // preview viewport (square)
const MAX_ZOOM = 4;

type Props = {
  /** Data-URL (or URL) of the image to crop, or null when closed. */
  src: string | null;
  onCancel: () => void;
  onConfirm: (squareDataUrl: string) => void;
};

/**
 * Passport-style crop step for the student photo flow. Opens with the image
 * already visible and correctly cover-cropped (no "drag to reveal" bug, no
 * black letterboxing — the shared crop helpers paint an opaque white base).
 *
 * Shows a head-to-chest oval guide so the student frames a passport photo
 * before the local verification gates run on the cropped result.
 */
export function AvatarCropDialog({ src, onCancel, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<{ src: string; el: HTMLImageElement } | null>(null);
  const [transform, setTransform] = useState<CropTransform>({
    zoom: 1,
    pan: { x: 0, y: 0 },
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Load the image whenever a new src arrives; reset framing. setState only
  // happens in the (async) load callbacks, never synchronously in the effect.
  useEffect(() => {
    if (!src) return;
    const image = new Image();
    image.onload = () => setImg({ src, el: image });
    image.onerror = () => setImg(null);
    image.src = src;
  }, [src]);

  // The element is only used once it belongs to the current src — this avoids
  // briefly drawing a previously-loaded image when a new file is opened.
  const activeImg = img && img.src === src ? img.el : null;

  // Redraw on any transform / image change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImg) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCropPreview(ctx, activeImg, VIEW, transform);
  }, [activeImg, transform]);

  // Keep the pan within bounds so an empty edge can't enter the frame.
  const updatePan = useCallback(
    (x: number, y: number) => {
      if (!activeImg) return;
      setTransform((t) => ({ ...t, pan: clampPan(activeImg, VIEW, t.zoom, { x, y }) }));
    },
    [activeImg],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: transform.pan.x, panY: transform.pan.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    updatePan(
      dragStart.current.panX + (e.clientX - dragStart.current.x),
      dragStart.current.panY + (e.clientY - dragStart.current.y),
    );
  };
  const onPointerUp = () => setDragging(false);

  const setZoom = (z: number) => {
    if (!activeImg) return;
    const next = Math.min(Math.max(Number(z.toFixed(2)), 1), MAX_ZOOM);
    setTransform((t) => ({ zoom: next, pan: clampPan(activeImg, VIEW, next, t.pan) }));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom(transform.zoom - e.deltaY * 0.002);
  };

  const handleConfirm = () => {
    if (!activeImg) return;
    onConfirm(exportSquareCrop(activeImg, VIEW, transform));
  };

  return (
    <Dialog open={!!src} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Drag to reposition and zoom so your head and shoulders fit inside the
            oval — like a passport photo. We&apos;ll check it automatically next.
          </p>
        </DialogHeader>

        <div className="grid place-items-center">
          <div className="relative overflow-hidden rounded-xl border bg-white shadow-sm">
            <canvas
              ref={canvasRef}
              width={VIEW}
              height={VIEW}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onWheel={handleWheel}
              className="touch-none"
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            />
            {/* Head-to-chest oval guide overlay (visual only, not exported) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[38%] h-[62%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-sky-500/80"
            />
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(transform.zoom - 0.2)}>
            <IconZoomOut size={16} aria-hidden="true" />
          </Button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            value={transform.zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            aria-label="Zoom level"
            className="flex-1 accent-primary"
          />
          <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(transform.zoom + 0.2)}>
            <IconZoomIn size={16} aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Reset zoom and position" title="Reset" onClick={() => setTransform({ zoom: 1, pan: { x: 0, y: 0 } })}>
            <IconRefresh size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-1.5 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!activeImg}>
            <IconCheck size={15} aria-hidden="true" />
            Use this photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
