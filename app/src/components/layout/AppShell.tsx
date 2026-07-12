import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeader } from "./AppHeader";

export function AppShell() {
  return (
    <TooltipProvider>
      <div className="flex min-h-full flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <Outlet />
        </main>
        <Toaster richColors position="top-center" />
      </div>
    </TooltipProvider>
  );
}

export function AppShellLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}
