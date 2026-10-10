"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  IconCamera,
  IconCheck,
  IconRefresh,
  IconTrash,
  IconUserCircle,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { clampPan, drawCropPreview, exportSquareCrop } from "@/app/lib/crop";

type ImageUploadCropProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ImageUploadCrop({
  label,
  value,
  onChange,
  disabled = false,
}: ImageUploadCropProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Crop transformations
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CROP_SIZE = 260; // preview canvas dimensions (square)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setModalOpen(true);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);

    // Reset file input so selecting the same file triggers change
    e.target.value = "";
  };

  // Draw the preview onto the interactive canvas using the shared helpers —
  // paints an opaque white base then cover-crops, so the image is visible
  // immediately on open (the old version left a transparent canvas over a dark
  // viewport, which read as "black / nothing until I drag").
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCropPreview(ctx, imageObj, CROP_SIZE, { zoom, pan });
  }, [imageObj, zoom, pan]);

  useEffect(() => {
    if (modalOpen && imageObj) {
      drawPreview();
    }
  }, [modalOpen, imageObj, drawPreview]);

  // Pan interaction (pointer events cover mouse + touch uniformly)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const next = clampPan(imageObj!, CROP_SIZE, zoom, {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
    setPan(next);
  };
  const handlePointerUp = () => setIsDragging(false);

  const setZoomClamped = (z: number) => {
    const next = Math.min(Math.max(z, 1), 3.5);
    setZoom(next);
    if (imageObj) setPan((p) => clampPan(imageObj, CROP_SIZE, next, p));
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoomClamped(zoom + e.deltaY * -0.0015);
  };

  // Perform Final Crop to high-res 320x320 JPEG (shared export math)
  const handleCropApply = () => {
    if (!imageObj) return;
    onChange(exportSquareCrop(imageObj, CROP_SIZE, { zoom, pan }));
    setModalOpen(false);
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={`group relative flex w-full cursor-pointer items-center gap-3.5 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
          value ? "border-solid bg-card" : "border-dashed hover:border-ring"
        }`}
        onClick={() => {
          if (!disabled) fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <span className="relative grid size-13 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-muted text-muted-foreground transition-colors group-hover:border-ring [&_img]:size-full [&_img]:object-cover">
          {value ? (
            <>
              <img src={value} alt="Profile photo preview" />
              <span className="absolute inset-0 grid place-items-center bg-slate-900/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <IconCamera size={18} aria-hidden="true" />
              </span>
            </>
          ) : (
            <IconUserCircle size={28} aria-hidden="true" />
          )}
        </span>

        <span className="grid min-w-0 flex-1 gap-0.5 [&_strong]:text-[13px] [&_strong]:font-semibold [&_small]:text-[11px] [&_small]:text-muted-foreground">
          {value ? (
            <>
              <strong>Profile photo ready</strong>
              <small>Click the photo or “Change” to pick a new one</small>
            </>
          ) : (
            <>
              <strong>Upload a profile photo</strong>
              <small>Click to browse — JPG, PNG or WEBP. Cropped to a square.</small>
            </>
          )}
        </span>

        <span className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <IconCamera size={14} aria-hidden="true" />
            {value ? "Change" : "Choose Image"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <IconTrash size={14} aria-hidden="true" />
              Remove
            </Button>
          )}
        </span>
      </div>

      {/* Interactive Crop Modal */}
      {modalOpen && (
        <Dialog open onOpenChange={(open) => !open && setModalOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-135">
            <DialogHeader>
              <DialogTitle>Crop &amp; Resize Photo</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Drag to center your face or photo and adjust zoom to fit inside the square.
              </p>
            </DialogHeader>

            <div className="grid gap-4">
              {/* Canvas Viewport */}
              <div className="grid place-items-center overflow-hidden rounded-xl border bg-white p-2 dark:bg-card">
                <canvas
                  ref={canvasRef}
                  width={CROP_SIZE}
                  height={CROP_SIZE}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onWheel={handleWheel}
                  className="touch-none"
                  style={{
                    width: `${CROP_SIZE}px`,
                    height: `${CROP_SIZE}px`,
                    cursor: isDragging ? "grabbing" : "grab",
                    borderRadius: "8px",
                    touchAction: "none",
                  }}
                />
              </div>

              {/* Zoom Controls */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Zoom</span>
                  <span className="inline-block min-w-11 text-right text-xs font-bold tabular-nums">{zoom.toFixed(1)}x</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Zoom out"
                    aria-label="Zoom out"
                    onClick={() => setZoomClamped(zoom - 0.2)}
                  >
                    <IconZoomOut size={16} aria-hidden="true" />
                  </Button>
                  <input
                    type="range"
                    min="1"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
                    aria-label="Zoom level"
                    className="flex-1 accent-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Zoom in"
                    aria-label="Zoom in"
                    onClick={() => setZoomClamped(zoom + 0.2)}
                  >
                    <IconZoomIn size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Reset zoom and position"
                    aria-label="Reset zoom and position"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <IconRefresh size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-1.5 flex justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                 
                  onClick={handleCropApply}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <IconCheck size={15} aria-hidden="true" />
                  Apply Photo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
