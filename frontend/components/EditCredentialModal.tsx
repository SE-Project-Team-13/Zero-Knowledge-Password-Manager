"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, RefreshCw, X, Eye, EyeOff, Edit, Sparkles } from "lucide-react";
import { generatePassword, calculatePasswordStrength } from "@/lib/password-utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { DecryptedEntry } from "@/context/VaultContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

interface EditCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: DecryptedEntry | null;
  onSave: (updatedEntry: DecryptedEntry) => Promise<void>;
}


export function EditCredentialModal({
  isOpen,
  onClose,
  entry,
  onSave,
}: EditCredentialModalProps) {
  const [formData, setFormData] = useState<DecryptedEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({ ...entry });
      setIsPasswordVisible(entry.isPasswordVisible);
    }
  }, [entry, isOpen]);

  const handleSave = async () => {
    if (!formData) return;
    
    if (!formData.url || !formData.username || !formData.password) {
      toast.error("Please complete all required fields (URL, Username, and Password)");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error("Failed to save entry:", err);
      // specific error toast should be handled by caller or global handler
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !formData) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl bg-card">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Edit Credential
              </CardTitle>
              <CardDescription>Update your stored credential information</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="edit-url" className="text-foreground/80">URL</Label>
            <Input
              id="edit-url"
              type="url"
              placeholder="https://example.com"
              value={formData.url || ""}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              className="bg-secondary/50 border-input focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-username" className="text-foreground/80">Username/Email</Label>
            <Input
              id="edit-username"
              placeholder="your@email.com"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="bg-secondary/50 border-input focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="edit-password" className="text-foreground/80">Password</Label>
              {(() => {
                const strength = calculatePasswordStrength(formData.password);
                return (
                  <span className={`text-xs uppercase tracking-wider font-bold ${strength.color.replace("bg-", "text-")}`}>
                    {strength.label}
                  </span>
                );
              })()}
            </div>
            <div className="relative">
              <Input
                id="edit-password"
                type={isPasswordVisible ? "text" : "password"}
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pr-20 bg-secondary/50 border-input focus:border-primary font-mono"
                required
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                  onClick={() => {
                    const newPass = generatePassword();
                    setFormData({ ...formData, password: newPass });
                    toast.success("Strong password generated");
                  }}
                  title="Generate strong password"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {(() => {
                const strength = calculatePasswordStrength(formData.password);
                return (
                  <Progress value={strength.score} className="h-1.5" indicatorClassName={strength.color} />
                );
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="text-foreground/80">Notes (optional)</Label>
            <textarea
              id="edit-notes"
              placeholder="Additional information"
              rows={3}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-secondary/50 text-foreground placeholder-muted-foreground"
            />
          </div>
        </CardContent>

        <CardFooter className="border-t border-border flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
