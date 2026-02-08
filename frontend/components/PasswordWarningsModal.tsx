"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import type { DecryptedEntry } from "@/context/VaultContext";
import { usePasswordAging } from "@/hooks/usePasswordAging";

interface PasswordWarningsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (entry: DecryptedEntry) => void;
}

export function PasswordWarningsModal({
  isOpen,
  onClose,
  onEdit,
}: PasswordWarningsModalProps) {
  const { agingEntries, getLastUpdatedMs, snoozeEntry } = usePasswordAging();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-heading">Password Warnings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Passwords older than 365 days should be updated. You can snooze each warning for 7 days.
          </DialogDescription>
        </DialogHeader>

        {agingEntries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
            <p className="text-sm font-medium">No old passwords detected</p>
            <p className="text-xs opacity-70 mt-1">Your vault is looking secure!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {agingEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/50 p-4 hover:border-primary/20 transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {entry.site}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate pl-4 mb-1">
                    {entry.username}
                  </p>
                  <p className="text-[10px] text-muted-foreground pl-4 opacity-70">
                    Updated {formatDistanceToNow(new Date(getLastUpdatedMs(entry)), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => snoozeEntry(entry.id)}
                  >
                    Snooze 7 days
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => {
                      onClose();
                      onEdit(entry);
                    }}
                  >
                    Edit now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
