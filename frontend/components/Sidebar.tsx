"use client";

import React from "react";
import {
  ShieldCheck,
  Key,
  Shield,
  Lock,
  LogOut,
  Search,
  Settings,
  User,
  Heart,
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  FileKey,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SidebarProps {
  className?: string;
  onLogout: () => void;
  userEmail?: string;
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  activeView: string;
  setActiveView?: (view: string) => void;
  onEmergencyKit?: () => void;
  onChangePassword?: () => void;
  fullName?: string | null;
  onPasswordAging?: () => void;
  passwordAgingCount?: number;
}

export function Sidebar({
  className,
  onLogout,
  userEmail,
  isCollapsed,
  setIsCollapsed,
  activeView,
  setActiveView,
  onEmergencyKit,
  onChangePassword,
  fullName,
  onPasswordAging,
  passwordAgingCount = 0,
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: "Home", id: "home", href: "/dashboard" },
    { icon: Key, label: "Password Manager", id: "password-manager", href: "/password-manager" },
    { icon: Shield, label: "Security Audit", id: "security-audit", href: "#" },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/80 backdrop-blur-md border-border shadow-sm"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card border-r border-border transition-all duration-300 lg:translate-x-0 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-20" : "w-72 shadow-2xl",
          className,
        )}
      >
        {/* Header */}
        <div className={cn("p-6 flex items-center transition-all", isCollapsed ? "justify-center" : "gap-3")}>
          <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden text-center">
              <h1 className="text-xl font-bold text-foreground tracking-tight font-heading truncate leading-none">
                ZeroKnowledge
              </h1>
              <span className="text-primary font-bold text-lg leading-none">Vault</span>
            </div>
          )}
        </div>



        {/* Navigation */}
        <nav className={cn("flex-1 px-4 space-y-1", isCollapsed && "px-2")}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                activeView === item.id
                  ? "bg-primary/10 text-primary border border-primary/10"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", activeView === item.id && "text-primary")} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}

          {onPasswordAging && (
            <button
              onClick={onPasswordAging}
              title={isCollapsed ? "Password Warnings" : undefined}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110 text-amber-500" />
              {!isCollapsed && (
                <>
                  <span className="truncate">Password Warnings</span>
                  {passwordAgingCount > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/15 text-amber-600 text-[10px] px-2 py-0.5">
                      {passwordAgingCount}
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </nav>

        {/* Footer Area */}
        <div className={cn("p-4 mt-auto border-t border-border space-y-4", isCollapsed && "p-2")}>

          {/* Settings & Theme Actions */}
          <div className={cn("space-y-1", isCollapsed && "px-0")}>
            {onEmergencyKit && (
              <button
                onClick={onEmergencyKit}
                title={isCollapsed ? "Emergency Kit" : undefined}
                className={cn(
                  "w-full flex items-center rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:bg-secondary hover:text-foreground",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                )}
              >
                <FileKey className="h-5 w-5 shrink-0 transition-transform group-hover:-rotate-12" />
                {!isCollapsed && <span className="truncate">Emergency Kit</span>}
              </button>
            )}

            <Link
              href="/settings"
              title={isCollapsed ? "Settings" : undefined}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                 activeView === "settings"
                  ? "bg-primary/10 text-primary border border-primary/10"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Settings className={cn("h-5 w-5 shrink-0 transition-transform group-hover:rotate-90", activeView === "settings" && "text-primary")} />
              {!isCollapsed && <span className="truncate">Settings</span>}
            </Link>

            <button
              title={mounted && isCollapsed ? (resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode") : undefined}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:bg-secondary hover:text-foreground",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              )}
            >
              {mounted && resolvedTheme === 'dark' ? (
                <Sun className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-90" />
              ) : (
                <Moon className="h-5 w-5 shrink-0 transition-transform group-hover:-rotate-12" />
              )}
              {!isCollapsed && <span className="truncate">{mounted && resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode"}</span>}
            </button>
          </div>

          {/* User Profile */}
          {userEmail && (
            <div className={cn("flex items-center transition-all bg-secondary/30 rounded-xl", isCollapsed ? "justify-center" : "gap-3 px-3 py-2")}>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                <User className="h-4 w-4" />
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {fullName || userEmail.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate opacity-70">
                      {userEmail}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onLogout}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 ml-1"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
            {!isCollapsed && <span className="truncate">End-to-end Encrypted</span>}
          </div>
        </div>
      </aside>
    </>
  );
}
