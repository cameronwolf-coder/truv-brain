"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { USE_CASES } from "@/lib/use-cases";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 font-bold text-white text-sm">
            T
          </div>
          <div>
            <span className="font-semibold text-white text-sm">Truv</span>
            <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70 uppercase tracking-wider">
              Gov
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"}>
                  <Link href="/">
                    <span>🏠</span>
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-wider">
            Verification Products
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {USE_CASES.map((uc) => (
                <SidebarMenuItem key={uc.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/demo/${uc.key}`}
                  >
                    <Link href={`/demo/${uc.key}`}>
                      <span>{uc.icon}</span>
                      <span>{uc.shortName}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
