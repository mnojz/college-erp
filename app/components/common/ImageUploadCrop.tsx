"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
    <div style={{ display: "grid", gap: "6px" }}>
      <span
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "var(--ink-soft, #475569)",
        }}
      >
        {label}
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px dashed var(--line, #e2e8f0)",
          background: "var(--panel, #fff)",
        }}
      >
        {value ? (
          <img
            src={value}
            alt="Profile Preview"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              objectFit: "cover",
              border: "1px solid #0ea5e9",
            }}
          />
        ) : (
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#f1f5f9",
              display: "grid",
              placeItems: "center",
              fontSize: "18px",
              color: "#94a3b8",
            }}
          >
            📷
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", flex: 1, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              background: "#0ea5e9",
              color: "#fff",
              fontSize: "12px",
              fontWeight: "600",
              border: 0,
              cursor: "pointer",
            }}
          >
            {value ? "Change Photo" : "Select Image from Device"}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid var(--line, #e2e8f0)",
                color: "#ef4444",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Interactive Crop Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--panel, #fff)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "380px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "grid",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "16px" }}>Crop &amp; Resize Photo</strong>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "0 4px",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-soft, #64748b)" }}>
              Drag to center your face/photo and adjust zoom to fit inside the square.
            </p>

            {/* Canvas Viewport */}
            <div
              style={{
                display: "grid",
                placeItems: "center",
                background: "#0f172a",
                borderRadius: "12px",
                padding: "8px",
                overflow: "hidden",
              }}
            >
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

            {/* Zoom Slider */}
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--ink-soft)" }}>
                <span>Zoom</span>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#0ea5e9" }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #e2e8f0)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropApply}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: 0,
                  background: "#0ea5e9",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Crop &amp; Apply Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
