"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Lightbulb,
  Menu,
  SquareCheckBig,
  X,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BackendUser } from "@/lib/backend";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/analyst", label: "Analyst", icon: BrainCircuit },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/tasks", label: "Tasks", icon: SquareCheckBig },
];

type WorkspaceHeaderProps = {
  user: BackendUser;
};

export function WorkspaceHeader({ user }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const displayName = user.name?.trim() || user.email;
  const accountLabel = pathname.startsWith("/settings") ? "Account settings" : "Open settings";

  return (
    <header className="shrink-0 rounded-[1.5rem] border border-sidebar-border/80 bg-sidebar/80 px-4 py-3 text-sidebar-foreground shadow-[0_18px_50px_rgba(11,18,32,0.16)] backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <Image
            src="/solon-logo.png"
            alt="Solon logo"
            width={44}
            height={44}
            className="size-11 shrink-0 object-contain"
            priority
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase">Solon</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              In all things let reason be your guide.
            </p>
          </div>
        </Link>

        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>

        <div
          className={cn(
            "basis-full items-center gap-2.5 border-t border-sidebar-border/60 pt-3 lg:flex lg:basis-auto lg:border-t-0 lg:pt-0",
            isMenuOpen ? "flex flex-col" : "hidden",
          )}
        >
          <nav className="flex w-full flex-col gap-1.5 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex w-full flex-col gap-2 lg:ml-auto lg:w-auto lg:flex-row lg:items-center">
            <ThemeToggle className="rounded-full border-sidebar-border/70 bg-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/70 px-3 py-2 transition hover:bg-sidebar-accent lg:min-w-[260px]"
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] tracking-[0.16em] text-sidebar-foreground/45 uppercase">{accountLabel}</p>
                <p className="truncate text-sm font-medium">{displayName}</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-sidebar-foreground/45" />
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
