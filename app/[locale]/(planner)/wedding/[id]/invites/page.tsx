"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { generateWhatsAppLink, generateReminderLink } from "@/lib/whatsapp";
import { generateEmailLink } from "@/lib/email";
import { toast } from "sonner";

export default function InvitesPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestGroups, setGuestGroups] = useState<{ id: string; name: string }[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [callingGuests, setCallingGuests] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [guestsWithEmail, setGuestsWithEmail] = useState<Guest[]>([]);
  const [guestsWithInvalidEmail, setGuestsWithInvalidEmail] = useState<Guest[]>([]);
  const [guestsWithoutEmail, setGuestsWithoutEmail] = useState<Guest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const sideColors: Record<string, { bg: string; text: string }> = {
    bride: { bg: "bg-pink-50 border-pink-200", text: "text-pink-600" },
    groom: { bg: "bg-blue-50 border-blue-200", text: "text-blue-600" },
    both: { bg: "bg-purple-50 border-purple-200", text: "text-purple-600" },
  };

  // Collapsed family groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroupCollapse(groupId: string) {
    const next = new Set(collapsedGroups);
    next.has(groupId) ? next.delete(groupId) : next.add(groupId);
    setCollapsedGroups(next);
  }

  const fetchData = useCallback(async () => {
    const [weddingRes, guestRes, groupRes, funcRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    if (groupRes.data) setGuestGroups(groupRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pendingGuests = guests.filter((g) => !g.invite_sent_at);
  const sentGuests = guests.filter((g) => g.invite_sent_at);
  const pendingRsvpGuests = guests.filter((g) => g.invite_sent_at && g.overall_status === "pending");

  const filteredGuests = (filter === "all" ? guests : filter === "pending" ? pendingGuests : sentGuests)
    .filter((g) => searchQuery
      ? g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone.includes(searchQuery)
      : true
    );
  const totalPages = Math.ceil(filteredGuests.length / pageSize);
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [filter, searchQuery]);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredGuests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGuests.map((g) => g.id)));
    }
  }

  async function markAsSent(guestId: string) {
    await supabase.from("guests").update({ invite_sent_at: new Date().toISOString() }).eq("id", guestId);
    fetchData();
  }

  async function markAllAsSent(guestIds: string[]) {
    await supabase.from("guests").update({ invite_sent_at: new Date().toISOString() }).in("id", guestIds);
    toast.success(`${guestIds.length} invites marked as sent`);
    fetchData();
  }

  function copyInviteLink(token: string) {
    navigator.clipboard.writeText(`${baseUrl}/invite/${token}`);
    toast.success("🔗 Invite link copied!");
  }

  async function handleSyncRSVPs() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/wedding/${weddingId}/sync-call-rsvps`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "RSVPs synced successfully!");
        fetchData();
      } else {
        toast.error(data.error || "Failed to sync RSVPs");
      }
    } catch (error) {
      toast.error("Error syncing RSVPs");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAICall(targetGuestIds?: string[]) {
    const idsToCall = targetGuestIds || pendingGuests.map((g) => g.id);
    if (idsToCall.length === 0) return;
    setCallingGuests(true);
    const toastId = toast.loading(`Initiating AI call${idsToCall.length > 1 ? "s" : ""} to ${idsToCall.length} guest${idsToCall.length > 1 ? "s" : ""}...`);
    try {
      const response = await fetch(`/api/wedding/${weddingId}/ai-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: idsToCall }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`🤖 Initiated ${result.successful} AI calls! ${result.failed > 0 ? `${result.failed} failed.` : ""}`, { id: toastId });
        fetchData();
      } else {
        toast.error(`Failed to trigger calls: ${result.error}`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while initiating calls", { id: toastId });
    } finally {
      setCallingGuests(false);
    }
  }

  async function handleBulkEmail(targetGuests?: Guest[]) {
    const selectedGuests = targetGuests || pendingGuests;
    if (selectedGuests.length === 0) { toast.error("No guests to email."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "yahoo.co.in"];
    const withEmail = selectedGuests.filter((g) => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split("@")[1];
      return emailRegex.test(g.email) && allowedDomains.includes(domain);
    });
    const withInvalidEmail = selectedGuests.filter((g) => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split("@")[1];
      return !emailRegex.test(g.email) || !allowedDomains.includes(domain);
    });
    const withoutEmail = selectedGuests.filter((g) => !g.email);
    if (withEmail.length === 0 && withInvalidEmail.length === 0) {
      toast.error("None of the selected guests have email addresses.");
      return;
    }
    setGuestsWithEmail(withEmail);
    setGuestsWithInvalidEmail(withInvalidEmail);
    setGuestsWithoutEmail(withoutEmail);
    setShowBulkEmailDialog(true);
  }

  async function confirmSendEmails() {
    setShowBulkEmailDialog(false);
    setSendingEmails(true);
    const toastId = toast.loading(`Sending emails to ${guestsWithEmail.length} guests...`);
    try {
      const response = await fetch(`/api/wedding/${weddingId}/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestIds: guestsWithEmail.map((g) => g.id) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to send emails");
      toast.success(`✉️ Sent ${result.successful} emails! ${result.failed > 0 ? `${result.failed} failed.` : ""}`, { id: toastId });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "An error occurred while sending emails", { id: toastId });
    } finally {
      setSendingEmails(false);
    }
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* HEADER */}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Invitations</h2>
          <p className="text-slate-500 font-medium">{wedding?.wedding_name}</p>
        </div>
        <button
          onClick={handleSyncRSVPs}
          disabled={syncing}
          className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-lg ${syncing ? "animate-spin" : ""}`}>
            {syncing ? "sync" : "refresh"}
          </span>
          {syncing ? "Syncing..." : "Sync RSVPs from AI Calls"}
        </button>
      </header>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-primary/10 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Invites</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{guests.length}</span>
            <span className="text-xs font-bold text-slate-400">Guests</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-primary/10 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Sent</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-600">{sentGuests.length}</span>
            {guests.length > 0 && (
              <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                {Math.round((sentGuests.length / guests.length) * 100)}% Done
              </span>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-primary/10 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Not Sent</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{pendingGuests.length}</span>
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending</span>
          </div>
        </div>
      </div>

      {/* ACTION CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Amber Alert */}
        {pendingGuests.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 mt-1">chat_bubble</span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{pendingGuests.length} invites not sent yet</h4>
                <p className="text-slate-600 text-sm">Send via WhatsApp to complete outreach.</p>
              </div>
            </div>
            <button
              onClick={() => markAllAsSent(pendingGuests.map((g) => g.id))}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:bg-primary/90 transition-colors"
            >
              Mark All Sent
            </button>
          </div>
        )}

        {/* Blue Reminder */}
        {pendingRsvpGuests.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-600 mt-1">notifications_active</span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{pendingRsvpGuests.length} guests haven&apos;t RSVPed yet</h4>
                <p className="text-slate-600 text-sm">Follow up with guests who haven&apos;t confirmed.</p>
              </div>
            </div>
            <button
              onClick={() => {
                const links = pendingRsvpGuests.map((g) => (wedding ? generateReminderLink(g, wedding) : "")).join("\n");
                navigator.clipboard.writeText(links);
                toast.success("Reminder links copied!");
              }}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:opacity-90 transition-opacity"
            >
              Copy Reminder Links
            </button>
          </div>
        )}

        {/* AI Call Card */}
        <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-purple-600 mt-1">smart_toy</span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">AI Voice Calls</h4>
              <p className="text-slate-600 text-sm">Auto-call pending guests to collect RSVPs.</p>
            </div>
          </div>
          <button
            onClick={() => handleAICall(pendingRsvpGuests.map((g) => g.id))}
            disabled={callingGuests || pendingRsvpGuests.length === 0}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {callingGuests ? "Calling..." : `Call ${pendingRsvpGuests.length} Guests`}
          </button>
        </div>

        {/* Email Invitations Card */}
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 mt-1">mail</span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Email Invitations</h4>
              <p className="text-slate-600 text-sm">Send invite emails to guests with email addresses.</p>
            </div>
          </div>
          <button
            onClick={() => handleBulkEmail(pendingGuests.filter((g) => !!g.email))}
            disabled={sendingEmails}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {sendingEmails ? "Sending..." : "Email Pending"}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
        {/* Filter Tabs + Search */}
        <div className="px-6 py-4 border-b border-primary/10 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredGuests.length && filteredGuests.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-slate-300 text-primary focus:ring-primary"
              title="Select all"
            />
            <div className="flex gap-1 p-1 bg-[#f8f7f5] rounded-lg">
              {(["all", "pending", "sent"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md capitalize ${
                    filter === f ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f} ({f === "all" ? guests.length : f === "pending" ? pendingGuests.length : sentGuests.length})
                </button>
              ))}
            </div>
          </div>
          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-3 w-10"></th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Guest Name</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Side</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Invitation</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">RSVP Status</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {(() => {
                const rows: React.ReactNode[] = [];

                // Separate grouped and ungrouped guests (from paginated list)
                const grouped = new Map<string, Guest[]>();
                const ungrouped: Guest[] = [];

                for (const g of paginatedGuests) {
                  if (g.group_id) {
                    if (!grouped.has(g.group_id)) grouped.set(g.group_id, []);
                    grouped.get(g.group_id)!.push(g);
                  } else {
                    ungrouped.push(g);
                  }
                }

                // Helper: render one invite row
                function InviteRow({ guest, indent }: { guest: Guest; indent?: boolean }) {
                  return (
                    <tr key={guest.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(guest.id) ? "bg-primary/5" : indent ? "bg-slate-50/30" : ""}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(guest.id)}
                          onChange={() => toggleSelect(guest.id)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className={`${indent ? "pl-10 pr-6" : "px-6"} py-4`}>
                        <div className="flex items-center gap-3">
                          {indent && <span className="text-slate-300 text-sm">└</span>}
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary uppercase shrink-0">
                            {getInitials(guest.name)}
                          </div>
                          <p className="font-semibold text-sm">{guest.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold capitalize ${sideColors[guest.side]?.bg || "bg-slate-50 border-slate-200"} ${sideColors[guest.side]?.text || "text-slate-600"}`}>
                          {guest.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{guest.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          guest.invite_sent_at ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {guest.invite_sent_at ? "Sent" : "Not Sent"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold ${
                          guest.overall_status === "confirmed" ? "text-green-600"
                            : guest.overall_status === "declined" ? "text-red-500"
                            : "text-slate-400 italic"
                        }`}>
                          {guest.overall_status === "confirmed" ? "Attending"
                            : guest.overall_status === "declined" ? "Declined"
                            : guest.invite_sent_at ? "Awaiting Response" : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => copyInviteLink(guest.invite_token)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors" title="Copy Link">
                            <span className="material-symbols-outlined text-lg">content_copy</span>
                          </button>
                          {wedding && (
                            <a
                              href={generateWhatsAppLink(guest, wedding, functions)}
                              target="_blank"
                              rel="noopener"
                              onClick={() => markAsSent(guest.id)}
                              className={`p-2 rounded-lg transition-all ${
                                guest.invite_sent_at
                                  ? "hover:bg-green-50 text-slate-400 hover:text-green-600"
                                  : "bg-green-500 text-white active:scale-95 shadow-sm"
                              }`}
                              title="Send WhatsApp"
                            >
                              <span className="material-symbols-outlined text-lg">chat</span>
                            </a>
                          )}
                          <button
                            onClick={() => handleAICall([guest.id])}
                            disabled={callingGuests}
                            className="p-2 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
                            title="AI Voice Call"
                          >
                            <span className="material-symbols-outlined text-lg">call</span>
                          </button>
                          {wedding && guest.email && (
                            <a
                              href={generateEmailLink(guest, wedding, functions)}
                              className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                              title="Send Email"
                              onClick={() => markAsSent(guest.id)}
                            >
                              <span className="material-symbols-outlined text-lg">mail</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Render family sections
                for (const [groupId, members] of grouped.entries()) {
                  const group = guestGroups.find((g) => g.id === groupId);
                  const isCollapsed = collapsedGroups.has(groupId);
                  const allSent = members.every((m) => m.invite_sent_at);
                  const noneSent = members.every((m) => !m.invite_sent_at);
                  rows.push(
                    <tr key={`group-header-${groupId}`} className="bg-primary/5 border-b border-primary/10">
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={members.every((m) => selectedIds.has(m.id))}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            const allSelected = members.every((m) => selectedIds.has(m.id));
                            members.forEach((m) => allSelected ? next.delete(m.id) : next.add(m.id));
                            setSelectedIds(next);
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-6 py-3" colSpan={5}>
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleGroupCollapse(groupId)} className="flex items-center gap-2 flex-1 text-left">
                            <span className="material-symbols-outlined text-primary text-[18px]">
                              {isCollapsed ? "chevron_right" : "expand_more"}
                            </span>
                            <span className="material-symbols-outlined text-primary text-[16px]">family_restroom</span>
                            <span className="font-bold text-primary text-sm">{group?.name || "Unknown Family"}</span>
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-full">
                              {members.length} {members.length === 1 ? "member" : "members"}
                            </span>
                          </button>
                          {/* Family-level send all button */}
                          {!allSent && wedding && (
                            <button
                              onClick={() => markAllAsSent(members.filter((m) => !m.invite_sent_at).map((m) => m.id))}
                              className="ml-auto text-[11px] font-bold text-primary hover:underline whitespace-nowrap flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">mark_email_read</span>
                              {noneSent ? "Mark all sent" : "Mark remaining sent"}
                            </button>
                          )}
                          {allSent && (
                            <span className="ml-auto text-[11px] font-bold text-green-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              All sent
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  if (!isCollapsed) {
                    members.forEach((guest) => rows.push(<InviteRow key={guest.id} guest={guest} indent />));
                  }
                }

                // Render ungrouped guests normally
                ungrouped.forEach((guest) => rows.push(<InviteRow key={guest.id} guest={guest} />));

                return rows;
              })()}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-primary/10 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length} guests
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl shadow-slate-900/40 flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3 pl-2 shrink-0">
              <div className="bg-primary size-8 rounded-full flex items-center justify-center font-black text-sm">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-sm font-bold">{selectedIds.size} selected</p>
                <p className="text-[10px] text-slate-400 font-medium">Bulk actions</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 hover:bg-white/10 text-slate-300 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">close</span>
                Clear
              </button>
              <button
                onClick={() => handleAICall(Array.from(selectedIds))}
                disabled={callingGuests}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {callingGuests ? "sync" : "call"}
                </span>
                {callingGuests ? "Calling..." : `AI Call ${selectedIds.size}`}
              </button>
              <button
                onClick={() => handleBulkEmail(guests.filter((g) => selectedIds.has(g.id)))}
                disabled={sendingEmails}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">
                  {sendingEmails ? "sync" : "mail"}
                </span>
                {sendingEmails ? "Sending..." : `Email ${selectedIds.size}`}
              </button>
              <button
                onClick={() => markAllAsSent(Array.from(selectedIds))}
                className="px-3 py-2 bg-primary text-white rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all"
              >
                <span className="material-symbols-outlined text-lg">mark_email_read</span>
                Mark Sent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Email Confirmation Dialog */}
      {showBulkEmailDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkEmailDialog(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-2">Send Email Invitations</h3>
            <p className="text-slate-500 text-sm mb-6">Review before sending</p>
            <div className="space-y-3 mb-6">
              {guestsWithEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{guestsWithEmail.length} guests will receive emails</p>
                    <p className="text-xs text-slate-500">Valid email addresses</p>
                  </div>
                </div>
              )}
              {guestsWithInvalidEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="material-symbols-outlined text-amber-600">warning</span>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{guestsWithInvalidEmail.length} guests skipped</p>
                    <p className="text-xs text-slate-500">Invalid or unrecognised email domains</p>
                  </div>
                </div>
              )}
              {guestsWithoutEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="material-symbols-outlined text-slate-400">mail_off</span>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{guestsWithoutEmail.length} guests have no email</p>
                    <p className="text-xs text-slate-500">Will not be contacted</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkEmailDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendEmails}
                disabled={guestsWithEmail.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Send {guestsWithEmail.length} Emails
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
