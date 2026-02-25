"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Calculator,
  Filter,
  LineChart,
  Star,
  Zap,
  User,
  LogOut,
  HelpCircle,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlossaryDialog } from "@/components/glossary-dialog";
import { getMarketStatus } from "@/lib/market-hours";

const marketIndicatorStyles: Record<
  string,
  { dot: string; text: string; bg: string; border: string }
> = {
  "Market Open": {
    dot: "bg-accent animate-pulse",
    text: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  "Pre-market": {
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  "Market Closed": {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-muted/20",
  },
  Weekend: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-muted/20",
  },
};

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/signals", label: "Signals", icon: Zap },
  { href: "/paper-trade", label: "Paper Trade", icon: LineChart },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/calculator", label: "Calculator", icon: Calculator },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const indicatorStyle =
    marketIndicatorStyles[marketStatus.label] ??
    marketIndicatorStyles["Market Closed"];

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const displayName =
    (user?.user_metadata?.name as string) ||
    user?.email?.split("@")[0] ||
    "User";

  const displayEmail = user?.email || "";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">
              Nifty Velocity <span className="text-primary">Alpha</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGlossaryOpen(true)}
              className="text-muted-foreground hover:text-foreground"
              title="Glossary & Quick Reference"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-muted-foreground hover:text-foreground"
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            )}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${indicatorStyle.bg} border ${indicatorStyle.border}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${indicatorStyle.dot}`}
              />
              <span
                className={`text-xs ${indicatorStyle.text} font-mono`}
              >
                {marketStatus.label.toUpperCase()}
              </span>
            </div>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url as string}
                        alt={displayName}
                        className="w-6 h-6 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="hidden md:inline text-sm">
                      {displayName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {displayEmail}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {role === "admin" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => router.push("/admin")}
                        className="cursor-pointer"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <GlossaryDialog open={glossaryOpen} onOpenChange={setGlossaryOpen} />
    </nav>
  );
}
