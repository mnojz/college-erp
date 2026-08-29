"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  IconCamera,
  IconCheck,
  IconRefresh,
  IconTrash,
  IconUserCircle,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";

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

  // Draw the preview onto the interactive canvas
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Base scale to cover the square canvas
    const baseScale = Math.max(
      CROP_SIZE / imageObj.naturalWidth,
      CROP_SIZE / imageObj.naturalHeight
    );
    const scale = baseScale * zoom;

    const scaledWidth = imageObj.naturalWidth * scale;
    const scaledHeight = imageObj.naturalHeight * scale;

    // Centered default + pan offset
    const drawX = (CROP_SIZE - scaledWidth) / 2 + pan.x;
    const drawY = (CROP_SIZE - scaledHeight) / 2 + pan.y;

    ctx.save();
    // Draw the image
    ctx.drawImage(imageObj, drawX, drawY, scaledWidth, scaledHeight);

    // Draw dark overlay outside circular/rounded square crop guide
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    // Top border
    ctx.fillRect(0, 0, CROP_SIZE, 0);

    // Crop border stroke
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, CROP_SIZE - 4, CROP_SIZE - 4);

    ctx.restore();
  }, [imageObj, zoom, pan]);

  useEffect(() => {
    if (modalOpen && imageObj) {
      drawPreview();
    }
  }, [modalOpen, imageObj, drawPreview]);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(Math.max(prev + delta, 1), 3.5));
  };

  // Perform Final Crop to high-res 320x320 JPEG
  const handleCropApply = () => {
    if (!imageObj) return;

    const outputSize = 320;
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return;

    const baseScale = Math.max(
      CROP_SIZE / imageObj.naturalWidth,
      CROP_SIZE / imageObj.naturalHeight
    );
    const scale = baseScale * zoom;

    const scaledWidth = imageObj.naturalWidth * scale;
    const scaledHeight = imageObj.naturalHeight * scale;

    const drawX = (CROP_SIZE - scaledWidth) / 2 + pan.x;
    const drawY = (CROP_SIZE - scaledHeight) / 2 + pan.y;

    // Scale up factor to output size
    const factor = outputSize / CROP_SIZE;

    ctx.drawImage(
      imageObj,
      drawX * factor,
      drawY * factor,
      scaledWidth * factor,
      scaledHeight * factor
    );

    const croppedDataUrl = outputCanvas.toDataURL("image/jpeg", 0.88);
    onChange(croppedDataUrl);
    setModalOpen(false);
  };

  return (
    <div className="image-upload">
      <span className="image-upload-label">{label}</span>

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
        className={`image-upload-zone${value ? " has-image" : ""}`}
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
        <span className="image-upload-avatar">
          {value ? (
            <>
              <img src={value} alt="Profile photo preview" />
              <span className="image-upload-avatar-overlay">
                <IconCamera size={18} aria-hidden="true" />
              </span>
            </>
          ) : (
            <IconUserCircle size={28} aria-hidden="true" />
          )}
        </span>

        <span className="image-upload-text">
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

        <span className="image-upload-actions">
          <button
            type="button"
            className="image-upload-btn"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <IconCamera size={14} aria-hidden="true" />
            {value ? "Change" : "Choose Image"}
          </button>
          {value && (
            <button
              type="button"
              className="image-upload-btn danger"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <IconTrash size={14} aria-hidden="true" />
              Remove
            </button>
          )}
        </span>
      </div>

      {/* Interactive Crop Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
            <button
              className="modal-close"
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close crop dialog"
            >
              <IconX size={18} aria-hidden="true" />
            </button>

            <h2 id="crop-modal-title">Crop &amp; Resize Photo</h2>

            <div className="crop-modal-body">
              <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-soft)" }}>
                Drag to center your face or photo and adjust zoom to fit inside the square.
              </p>

              {/* Canvas Viewport */}
              <div className="crop-modal-viewport">
                <canvas
                  ref={canvasRef}
                  width={CROP_SIZE}
                  height={CROP_SIZE}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onWheel={handleWheel}
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
              <div className="crop-zoom">
                <div className="crop-zoom-header">
                  <span>Zoom</span>
                  <span className="crop-zoom-badge">{zoom.toFixed(1)}x</span>
                </div>
                <div className="crop-zoom-controls">
                  <button
                    type="button"
                    className="crop-zoom-btn"
                    title="Zoom out"
                    aria-label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))}
                  >
                    <IconZoomOut size={16} aria-hidden="true" />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    aria-label="Zoom level"
                  />
                  <button
                    type="button"
                    className="crop-zoom-btn"
                    title="Zoom in"
                    aria-label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.2).toFixed(2))))}
                  >
                    <IconZoomIn size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="crop-zoom-btn"
                    title="Reset zoom and position"
                    aria-label="Reset zoom and position"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <IconRefresh size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="crop-modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCropApply}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <IconCheck size={15} aria-hidden="true" />
                  Apply Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
