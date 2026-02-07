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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  onLogout: () => void;
  userEmail?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

export function Sidebar({
  className,
  onLogout,
  userEmail,
  searchQuery,
  setSearchQuery,
  isCollapsed,
  setIsCollapsed,
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: "All Items", active: true },
    { icon: Heart, label: "Favorites", active: false },
    { icon: Shield, label: "Security Audit", active: false },
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
            <div className="flex flex-col overflow-hidden">
               <h1 className="text-xl font-bold text-foreground tracking-tight font-heading truncate leading-none">
                ZeroKnowledge
              </h1>
              <span className="text-primary font-bold text-lg leading-none">Vault</span>
            </div>
          )}
        </div>

        {/* Search - Mobile/Sidebar variant */}
        <div className={cn("px-6 mb-6 transition-all", isCollapsed ? "px-4" : "px-6")}>
          <div className="relative">
            <Search className={cn("absolute top-2.5 h-4 w-4 text-muted-foreground transition-all", isCollapsed ? "left-1/2 -translate-x-1/2" : "left-3")} />
            {!isCollapsed ? (
              <Input
                placeholder="Search..."
                className="pl-9 h-10 bg-secondary/50 border-input focus:border-primary text-sm rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            ) : (
                <div className="h-10 w-full" /> // Spacer for collapsed mode
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 px-4 space-y-1", isCollapsed && "px-2")}>
          {navItems.map((item) => (
            <button
              key={item.label}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                item.active
                  ? "bg-primary/10 text-primary border border-primary/10"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", item.active && "text-primary")} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer Area */}
        <div className={cn("p-4 mt-auto border-t border-border space-y-4", isCollapsed && "p-2")}>
          
          {/* Settings & Theme Actions */}
          <div className={cn("space-y-1", isCollapsed && "px-0")}>
             <button
              title={isCollapsed ? "Settings" : undefined}
              className={cn(
                "w-full flex items-center rounded-xl text-sm font-medium transition-all group text-muted-foreground hover:bg-secondary hover:text-foreground",
                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
              )}
            >
              <Settings className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-90" />
              {!isCollapsed && <span className="truncate">Settings</span>}
            </button>

            <button
              title={isCollapsed ? (resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode") : undefined}
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
                      {userEmail.split("@")[0]}
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
