"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, UserProfile, useUser } from "@clerk/nextjs";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "dashboard", href: "/dashboard" },
  { label: "Guest List", icon: "group", hrefFn: (id: string) => `/wedding/${id}/guests` },
  { label: "Seating Plan", icon: "table_chart", hrefFn: (id: string) => `/wedding/${id}/seating` },
  { label: "Invitations", icon: "mail", hrefFn: (id: string) => `/wedding/${id}/invites` },
  { label: "Analytics", icon: "analytics", hrefFn: (id: string) => `/wedding/${id}/analytics` },
  { label: "Check-In", icon: "qr_code_scanner", hrefFn: (id: string) => `/wedding/${id}/checkin` },
  { label: "Briefings", icon: "assignment", hrefFn: (id: string) => `/wedding/${id}/briefings` },
];

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [showSettings, setShowSettings] = useState(false);

  // Extract weddingId from path like /wedding/[id]/...
  const weddingIdMatch = pathname.match(/\/wedding\/([^/]+)/);
  const weddingId = weddingIdMatch?.[1];
  const isWeddingContext = weddingId && weddingId !== "new";

  function getHref(item: typeof NAV_ITEMS[0]) {
    if (item.href) return item.href;
    if (item.hrefFn && isWeddingContext) return item.hrefFn(weddingId);
    return "#";
  }

  function isActive(item: typeof NAV_ITEMS[0]) {
    const href = getHref(item);
    if (href === "#") return false;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const firstName = user?.firstName || "Planner";

  return (
    <div className="flex min-h-screen bg-[#f8f7f5]">
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-primary/10 flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined">favorite</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-slate-900 text-base font-bold leading-tight">WedSync</h1>
              <p className="text-primary text-xs font-medium uppercase tracking-wider">Wedding Planner</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const href = getHref(item);
            const active = isActive(item);
            const disabled = href === "#";

            return (
              <Link
                key={item.label}
                href={disabled ? "#" : href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active
                    ? "bg-primary/10 text-primary"
                    : disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-600 hover:bg-primary/5 hover:text-primary"
                  }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* New Wedding Button */}
        <div className="px-4 pb-4">
          <Link href="/wedding/new">
            <button className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
              <span className="material-symbols-outlined text-sm">add</span>
              New Wedding
            </button>
          </Link>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-primary/10">
          <div className="flex items-center gap-3 px-2">
            <UserButton />
            <div className="flex flex-col overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">
                {user?.fullName || firstName}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 lg:ml-64 flex flex-col min-w-0 relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 lg:border-primary/10">
          <h1 className="text-xl font-bold text-slate-800">
            Welcome back, {firstName} 👋
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={() => toast.info("No new notifications")} className="p-2 text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="lg:hidden">
              <UserButton />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSettings(false)}>
            <div className="max-h-[85vh] overflow-y-auto rounded-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end p-2 pb-0">
                <button onClick={() => setShowSettings(false)} className="text-white hover:text-slate-200">
                  <span className="material-symbols-outlined text-3xl drop-shadow-md">close</span>
                </button>
              </div>
              <UserProfile routing="hash" />
            </div>
          </div>
        )}
      </main>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-4 pb-6 pt-2 flex justify-around z-20">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const href = getHref(item);
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={href === "#" ? "#" : href}
              className={`flex flex-col items-center gap-1 ${active ? "text-primary" : "text-slate-400"
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
