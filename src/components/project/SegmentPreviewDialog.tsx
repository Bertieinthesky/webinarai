/**
 * SegmentPreviewDialog — Plays a segment's video in a modal dialog
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { storageUrl } from "@/lib/storage/urls";

interface SegmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  storageKey: string | null;
}

export function SegmentPreviewDialog({
  open,
  onOpenChange,
  label,
  storageKey,
}: SegmentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-zinc-950 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-medium text-white/80">
            {label}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          {storageKey ? (
            <video
              src={storageUrl(storageKey)}
              controls
              autoPlay
              className="w-full rounded-lg"
              style={{ aspectRatio: "16 / 9", backgroundColor: "#000" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg bg-white/[0.03]"
              style={{ aspectRatio: "16 / 9" }}
            >
              <span className="text-sm text-white/30">
                Video not available
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
