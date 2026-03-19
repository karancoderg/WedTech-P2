"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton, UserProfile, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Playfair_Display, Inter } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const inter = Inter({ subsets: ["latin"] });

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
  const [settingsTab, setSettingsTab] = useState<"profile" | "email">("profile");

  // Email Settings State
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [loadingSmtp, setLoadingSmtp] = useState(false);

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

  async function loadSmtpSettings() {
    setLoadingSmtp(true);
    try {
      const res = await fetch("/api/smtp-settings");
      const data = await res.json();
      if (data.configured) {
        setSmtpEmail(data.smtp_email);
        setSmtpConfigured(true);
      } else {
        setSmtpEmail("");
        setSmtpConfigured(false);
      }
    } catch {
      toast.error("Failed to load email settings");
    } finally {
      setLoadingSmtp(false);
    }
  }

  async function handleSaveSmtp() {
    if (!smtpEmail || !smtpPassword) {
      toast.error("Email and password are required");
      return;
    }
    setSavingSmtp(true);
    try {
      const res = await fetch("/api/smtp-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp_email: smtpEmail, smtp_password: smtpPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("✅ Email settings saved successfully!");
      setSmtpConfigured(true);
      setSmtpPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSavingSmtp(false);
    }
  }

  async function handleDeleteSmtp() {
    try {
      const res = await fetch("/api/smtp-settings", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove settings");
      toast.success("Email settings removed");
      setSmtpEmail("");
      setSmtpPassword("");
      setSmtpConfigured(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  function openSettings() {
    setShowSettings(true);
    setSettingsTab("profile");
  }

  function openEmailTab() {
    setSettingsTab("email");
    loadSmtpSettings();
  }

  const firstName = user?.firstName || "Planner";

  return (
    <div className={`flex min-h-screen bg-[#f8f7f5] ${inter.className} ${playfair.variable}`}>
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-primary/10 flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined">favorite</span>
            </div>
            <div className="flex flex-col">
              <h1 className={`text-slate-900 text-2xl font-bold leading-tight ${playfair.className}`}>WedSync</h1>
              <p className="text-primary text-[10px] font-bold uppercase tracking-widest mt-0.5">Wedding Planner</p>
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
      <main className="flex-1 lg:ml-64 flex flex-col min-w-0 relative planner-dash">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 lg:border-primary/10">
          <h1 className={`text-3xl font-bold text-slate-800 ${playfair.className}`}>
            Welcome back, {firstName} 👋
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={() => toast.info("No new notifications")} className="p-2 text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button onClick={openSettings} className="p-2 text-slate-500 hover:text-primary transition-colors">
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

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowSettings(false)}>
            <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col my-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
                <h2 className="text-xl font-black text-slate-900">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setSettingsTab("profile")}
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === "profile"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                >
                  <span className="material-symbols-outlined text-lg align-middle mr-1">person</span>
                  Profile
                </button>
                <button
                  onClick={openEmailTab}
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${settingsTab === "email"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                    }`}
                >
                  <span className="material-symbols-outlined text-lg align-middle mr-1">mail</span>
                  Email Settings
                </button>
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto max-h-[60vh] flex justify-center w-full">
                {settingsTab === "profile" && (
                  <div className="p-6">
                    <UserProfile routing="hash" />
                  </div>
                )}

                {settingsTab === "email" && (
                  <div className="p-6 space-y-6">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-3 p-4 rounded-2xl ${smtpConfigured ? "bg-green-50 border border-green-100" : "bg-amber-50 border border-amber-100"}`}>
                      <span className={`material-symbols-outlined ${smtpConfigured ? "text-green-600" : "text-amber-600"}`}>
                        {smtpConfigured ? "check_circle" : "warning"}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${smtpConfigured ? "text-green-700" : "text-amber-700"}`}>
                          {smtpConfigured ? "Email configured" : "Not configured"}
                        </p>
                        <p className={`text-xs ${smtpConfigured ? "text-green-600" : "text-amber-600"}`}>
                          {smtpConfigured
                            ? `Emails will be sent from ${smtpEmail}`
                            : "Configure your email to send invitations from your own account"}
                        </p>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
                        <div>
                          <p className="text-sm font-bold text-blue-700 mb-1">How to get your Gmail App Password</p>
                          <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                            <li>Go to your Google Account → Security</li>
                            <li>Enable 2-Factor Authentication (if not already)</li>
                            <li>Search for "App Passwords" in settings</li>
                            <li>Generate a new App Password for "Mail"</li>
                            <li>Copy the 16-character password below</li>
                          </ol>
                          <p className="text-xs text-blue-500 mt-2 font-medium">
                            💡 You can also use your regular Gmail password if you have "Less secure app access" enabled.
                          </p>
                        </div>
                      </div>
                    </div>

                    {loadingSmtp ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                        <span className="ml-2 text-sm text-slate-500">Loading settings...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gmail Address</label>
                          <input
                            type="email"
                            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            value={smtpEmail}
                            onChange={(e) => setSmtpEmail(e.target.value)}
                            placeholder="your-email@gmail.com"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {smtpConfigured ? "New Password (leave blank to keep current)" : "App Password"}
                          </label>
                          <input
                            type="password"
                            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            placeholder={smtpConfigured ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          {smtpConfigured && (
                            <button
                              onClick={handleDeleteSmtp}
                              className="px-5 py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                            >
                              Remove
                            </button>
                          )}
                          <button
                            onClick={handleSaveSmtp}
                            disabled={savingSmtp || !smtpEmail || (!smtpPassword && !smtpConfigured)}
                            className="flex-1 px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {savingSmtp ? (
                              <>
                                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                                Saving...
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">save</span>
                                {smtpConfigured ? "Update Settings" : "Save Settings"}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
