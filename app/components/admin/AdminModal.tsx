"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider dialog for content-heavy modals (e.g. notice detail previews). */
  wide?: boolean;
  /** Optional muted description rendered under the title. */
  description?: string;
}

export function AdminModal({
  title,
  onClose,
  children,
  wide = false,
  description,
}: AdminModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={wide ? "max-h-[90vh] overflow-y-auto sm:max-w-4xl" : "max-h-[90vh] overflow-y-auto sm:max-w-lg"}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
