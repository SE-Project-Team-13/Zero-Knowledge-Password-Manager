"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useVaultSync } from "@/hooks/useVaultSync";
import { Sidebar } from "@/components/Sidebar";
import { EmergencyKitModal } from "@/components/EmergencyKitModal";
import { PasswordWarningsModal } from "@/components/PasswordWarningsModal";
import { usePasswordAging } from "@/hooks/usePasswordAging";
import { EditCredentialModal } from "@/components/EditCredentialModal";
import { useVault } from "@/context/VaultContext";
import type { DecryptedEntry } from "@/context/VaultContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, actions] = useVaultSync();
  const { agingEntries } = usePasswordAging();
  const { updateEntry, isUnlocked, isLoadingVault } = useVault();
  const router = useRouter();
  const pathname = usePathname();

  // Determine active view for Sidebar
  const getActiveView = () => {
    if (pathname?.includes("/dashboard")) return "home";
    if (pathname?.includes("/password-manager")) return "password-manager";
    if (pathname?.includes("/settings")) return "settings";
    if (pathname?.includes("/add-credential")) return "password-manager"; // Consider add-credential under password-manager
    return "home";
  };

  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Sidebar Action Modals State
  const [isEmergencyKitOpen, setIsEmergencyKitOpen] = useState(false);
  const [isAgingModalOpen, setIsAgingModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false); // Managed by pages mostly, but sidebar *could* trigger it if we wanted

  // Edit Modal State for Warnings
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null);

  // Handle Edits from Warnings Modal
  const handleEditEntry = (entry: DecryptedEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (updatedEntry: DecryptedEntry) => {
    try {
      await updateEntry(updatedEntry);
      setIsEditModalOpen(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Failed to update entry:", error);
    }
  };

  // Auth check
  const [mounted, setMounted] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check OTP verification status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const otpStatus = sessionStorage.getItem("otp_verified") === "true";
      setIsOtpVerified(otpStatus);

      // Listen for OTP verification event from dashboard
      const handleOtpVerified = () => {
        setIsOtpVerified(true);
      };

      window.addEventListener("otpVerified", handleOtpVerified);
      return () => window.removeEventListener("otpVerified", handleOtpVerified);
    }
  }, []);

  useEffect(() => {
    if (mounted && !session.isLoading) {
       // Also check local storage token manually to avoid flicker if session state lags slightly
       const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token");
       if (!session.isAuthenticated && !hasToken) {
           // Clear OTP verified state when logging out
           setIsOtpVerified(false);
           router.push("/");
       }
    }
  }, [mounted, session.isAuthenticated, session.isLoading, router]);

  // Handle redirect if vault is locked (except on dashboard where unlock form exists)
  useEffect(() => {
    // We only redirect if we are sure session setup is done and we are not unlocked.
    // Also, we must not be on the dashboard itself, or we loop.
    if (mounted && !session.isLoading && !isLoadingVault && !isUnlocked && !pathname?.includes("/dashboard")) {
        // If we are not unlocked, and not loading, and not on dashboard, push to dashboard to unlock
        // But only if we are authenticated. If not authenticated, the other effect redirects to home.
        if (session.isAuthenticated) {
            toast.info("Please unlock your vault first.");
            router.push("/dashboard");
        }
    }
  }, [mounted, session.isLoading, isLoadingVault, isUnlocked, pathname, router, session.isAuthenticated]);

  // Show loading state while checking auth
  if (!mounted || (session.isLoading && !session.isAuthenticated)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {/* Only show Sidebar if OTP is verified */}
      {(isOtpVerified) && (
        <Sidebar
          activeView={getActiveView()}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onLogout={() => {
            actions.logout();
            window.location.href = "/";
          }}
          userEmail={session.email || undefined}
          fullName={session.fullName}
          // Sidebar Actions
          onEmergencyKit={() => setIsEmergencyKitOpen(true)}
          onPasswordAging={() => setIsAgingModalOpen(true)}
          passwordAgingCount={agingEntries.length}
        />
      )}

      {/* Main Content Wrapper */}
      {/* Dynamic margin based on collapsed state handled here */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300 flex flex-col min-w-0",
          (isOtpVerified) && !isCollapsed ? "lg:ml-72" : (isOtpVerified) && isCollapsed ? "lg:ml-20" : "ml-0"
        )}
      >
        {/* Mobile toggle is handled inside Sidebar component which uses fixed positioning */}
        {/* But main content needs to respect Sidebar width on Desktop */}
        
        {/* We render children here. Children pages should NOT have <Sidebar> or <main> wrapper with margins anymore. */}
        {children}
      </main>

      {/* Global Modals triggered from Sidebar */}
      <EmergencyKitModal
        isOpen={isEmergencyKitOpen}
        onClose={() => setIsEmergencyKitOpen(false)}
        email={session.email || ""}
      />

      <PasswordWarningsModal
        isOpen={isAgingModalOpen}
        onClose={() => setIsAgingModalOpen(false)}
        onEdit={(entry) => {
            setIsAgingModalOpen(false);
            handleEditEntry(entry);
        }}
      />

      <EditCredentialModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        entry={editingEntry}
        onSave={handleSaveEdit}
      />
      
      {/* Theme toggle is in Sidebar, but we might want one in the header of pages for accessibility if sidebar is hidden? */}
      {/* No, Sidebar handles it. */}
    </div>
  );
}
