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
import Image from "next/image";

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
        onMouseEnter={() => {
          if (window.innerWidth >= 1024) setIsCollapsed(false);
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 1024) setIsCollapsed(true);
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card border-r border-border transition-all duration-300 lg:translate-x-0 flex flex-col",
          isOpen ? "translate-x-0 w-72 shadow-2xl" : "-translate-x-full",
          "lg:w-20 lg:is-collapsed", // Default desktop state
          !isCollapsed && "lg:w-72 lg:shadow-2xl",
          className,
        )}
        style={{
          // Use inline style for width to override Tailwind classes more reliably if needed, 
          // but here we prefer class-based transitions.
        }}
      >
        {/* Helper to determine if we should show expanded content (either not collapsed OR on mobile) */}
        {(() => {
          const showExpanded = !isCollapsed || isOpen;
          
          return (
            <>
              {/* Header */}
              <div className={cn("p-6 flex items-center transition-all", (!showExpanded && !isOpen) ? "justify-center" : "gap-3")}>
                <div className="shrink-0">
                  <Image 
                    src="/logo.png" 
                    alt="Logo" 
                    width={48}
                    height={48}
                    className={cn("rounded-lg border border-primary/20 shadow-md transition-all object-cover", (!showExpanded && !isOpen) ? "h-10 w-10" : "h-12 w-12")}
                  />
                </div>
                {(showExpanded || isOpen) && (
                  <h1 className="text-xl font-bold text-foreground tracking-tight font-heading truncate leading-none">
                    Zenith <span className="text-primary font-bold">Vault</span>
                  </h1>
                )}
              </div>

              {/* Navigation */}
              <nav className={cn("flex-1 px-4 space-y-1", (!showExpanded && !isOpen) && "px-2")}>
                {navItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={(!showExpanded && !isOpen) ? item.label : undefined}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                      (!showExpanded && !isOpen) ? "justify-center p-3" : "gap-3 px-4 py-3",
                      activeView === item.id
                        ? "bg-primary/10 text-primary border border-primary/10"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", activeView === item.id && "text-primary")} />
                    {(showExpanded || isOpen) && <span className="truncate">{item.label}</span>}
                  </Link>
                ))}

                {onPasswordAging && (
                  <button
                    onClick={() => {
                        onPasswordAging();
                        setIsOpen(false);
                    }}
                    title={(!showExpanded && !isOpen) ? "Password Warnings" : undefined}
                    className={cn(
                      "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                      (!showExpanded && !isOpen) ? "justify-center p-3" : "gap-3 px-4 py-3",
                      "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110 text-amber-500" />
                    {(showExpanded || isOpen) && (
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
              <div className={cn("p-4 mt-auto border-t border-border space-y-4", (!showExpanded && !isOpen) && "p-2")}>
                {/* Settings & Theme Actions */}
                <div className={cn("space-y-1", (!showExpanded && !isOpen) && "px-0")}>
                  {onEmergencyKit && (
                    <button
                      onClick={() => {
                          onEmergencyKit();
                          setIsOpen(false);
                      }}
                      title={(!showExpanded && !isOpen) ? "Emergency Kit" : undefined}
                      className={cn(
                        "w-full flex items-center rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:bg-secondary hover:text-foreground",
                        (!showExpanded && !isOpen) ? "justify-center p-3" : "gap-3 px-4 py-3"
                      )}
                    >
                      <FileKey className="h-5 w-5 shrink-0 transition-transform group-hover:-rotate-12" />
                      {(showExpanded || isOpen) && <span className="truncate">Emergency Kit</span>}
                    </button>
                  )}

                  <Link
                    href="/settings"
                    title={(!showExpanded && !isOpen) ? "Settings" : undefined}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                      (!showExpanded && !isOpen) ? "justify-center p-3" : "gap-3 px-4 py-3",
                       activeView === "settings"
                        ? "bg-primary/10 text-primary border border-primary/10"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Settings className={cn("h-5 w-5 shrink-0 transition-transform group-hover:rotate-90", activeView === "settings" && "text-primary")} />
                    {(showExpanded || isOpen) && <span className="truncate">Settings</span>}
                  </Link>

                  <button
                    title={mounted && (!showExpanded && !isOpen) ? (resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode") : undefined}
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className={cn(
                      "w-full flex items-center rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:bg-secondary hover:text-foreground",
                      (!showExpanded && !isOpen) ? "justify-center p-3" : "gap-3 px-4 py-3"
                    )}
                  >
                    {mounted && resolvedTheme === 'dark' ? (
                      <Sun className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-90" />
                    ) : (
                      <Moon className="h-5 w-5 shrink-0 transition-transform group-hover:-rotate-12" />
                    )}
                    {(showExpanded || isOpen) && <span className="truncate">{mounted && resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode"}</span>}
                  </button>
                </div>

                {/* User Profile */}
                {userEmail && (
                  <div className={cn("flex items-center transition-all bg-secondary/30 rounded-xl", (!showExpanded && !isOpen) ? "justify-center" : "gap-3 px-3 py-2")}>
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    {(showExpanded || isOpen) && (
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
                  {(showExpanded || isOpen) && <span className="truncate">End-to-end Encrypted</span>}
                </div>
              </div>
            </>
          );
        })()}
      </aside>
    </>
  );
}
