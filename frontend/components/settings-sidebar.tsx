"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Settings2, Shield, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BackendUser } from "@/lib/backend";
import { cn } from "@/lib/utils";

const baseItems = [
  {
    href: "/settings",
    label: "Profile",
    description: "Identity, access, and session details.",
    icon: UserRound,
  },
];

export function SettingsSidebar({ user }: { user: BackendUser }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const items = user.is_admin
    ? [
        ...baseItems,
        {
          href: "/settings/admin",
          label: "Admin panel",
          description: "Approve and revoke workspace access.",
          icon: Shield,
        },
      ]
    : baseItems;

  return (
    <aside
      className={cn(
        "rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-[0_18px_50px_rgba(11,18,32,0.08)] backdrop-blur-md transition-all duration-200 xl:sticky xl:top-0",
        isCollapsed ? "xl:w-[96px]" : "xl:w-full",
      )}
    >
      <div className={cn("flex items-start gap-3", isCollapsed ? "justify-center" : "justify-between")}>
        <div
          className={cn(
            "rounded-[1.4rem] border border-border/70 bg-background/70 p-4 transition-all",
            isCollapsed ? "w-full px-3 py-4" : "flex-1",
          )}
        >
          <div className={cn("flex items-start gap-3", isCollapsed && "justify-center")}>
            <div className="rounded-2xl border border-border/70 bg-card/80 p-2">
              <Settings2 className="size-4 text-primary" />
            </div>
            <div className={cn(isCollapsed && "hidden")}>
              <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Account</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">{user.name?.trim() || user.email}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="hidden rounded-full xl:inline-flex"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-label={isCollapsed ? "Expand settings sidebar" : "Collapse settings sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <div className={cn("mt-4", isCollapsed && "hidden")}>
        <p className="px-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Navigation</p>
      </div>

      <nav className="mt-3 grid gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[1.25rem] border px-4 py-3 transition",
                isActive
                  ? "border-primary/25 bg-primary/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                  : "border-border/60 bg-background/55 hover:border-border hover:bg-background/80",
                isCollapsed && "px-3",
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={cn("flex items-center justify-between gap-3", isCollapsed && "justify-center")}>
                <span className="flex items-center gap-3">
                  <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", isCollapsed && "hidden")}>{item.label}</span>
                </span>
                {isCollapsed ? null : item.href === "/settings/admin" ? <Badge variant="gold">Admin</Badge> : null}
              </div>
              <p className={cn("mt-2 text-sm leading-6 text-muted-foreground", isCollapsed && "hidden")}>
                {item.description}
              </p>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 xl:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-2xl"
          onClick={() => setIsCollapsed((current) => !current)}
        >
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        </Button>
      </div>
    </aside>
  );
}
