"use client";

import { useEffect, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

interface AdminModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider dialog for content-heavy modals (e.g. notice detail previews). */
  wide?: boolean;
}

export function AdminModal({ title, onClose, children, wide = false }: AdminModalProps) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-box${wide ? " modal-box-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          <IconX size={18} aria-hidden="true" />
        </button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
