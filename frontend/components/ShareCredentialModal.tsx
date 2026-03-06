"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Loader2, AlertCircle } from "lucide-react";
import { DecryptedEntry, useVault } from "@/context/VaultContext";
import { toast } from "sonner";

interface ShareCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: DecryptedEntry | null;
}

export function ShareCredentialModal({
  isOpen,
  onClose,
  entry,
}: ShareCredentialModalProps) {
  const { sendShare } = useVault();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry || !email.trim()) return;

    setIsSending(true);
    setError(null);
    try {
      await sendShare(entry, email.trim());
      onClose();
      setEmail("");
    } catch (err: any) {
      console.error("[Share] Failed:", err);
      setError(err.message || "Could not share credential. Make sure the recipient has sharing enabled.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#0A0A0A] border-yellow-500/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <Share2 className="w-5 h-5" />
            Share Credential
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Securely share this password with another Zenith Vault user. They must have also enabled sharing in their settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleShare} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient" className="text-gray-300">Recipient Email</Label>
            <Input
              id="recipient"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/50 border-gray-800 focus:border-yellow-500/50 text-white"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex gap-2 items-start text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-md">
            <p className="text-[10px] text-yellow-500/70 leading-relaxed">
              This uses RSA-2048 and ECDSA end-to-end encryption. The server never sees the raw password or the session keys.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSending || !email.trim()}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sharing...
                </>
              ) : (
                "Share Securely"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
