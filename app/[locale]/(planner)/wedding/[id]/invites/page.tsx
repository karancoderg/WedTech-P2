"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const translations = {
  en: {
    invitationHeader: "You are Cordially Invited",
    groom_and_bride: "&",
    weddingCelebration: "Wedding Celebration",
    dear: "Dear",
    requestPleasure: "We request the pleasure of your company at the wedding celebrations of our children.",
    viewInvite: "View Invitation & RSVP",
    orScanQR: "Or scan the QR code on your card",
    fromDeskOf: "From the desk of",
    poweredBy: "Powered by WedSync • Premium Wedding Management"
  },
  hi: {
    invitationHeader: "आप सादर आमंत्रित हैं",
    groom_and_bride: "और",
    weddingCelebration: "विवाह समारोह",
    dear: "प्रिय",
    requestPleasure: "हम अपने बच्चों के विवाह उत्सव में आपकी उपस्थिति का आनंद लेने का अनुरोध करते हैं।",
    viewInvite: "निमंत्रण और RSVP देखें",
    orScanQR: "या अपने कार्ड पर QR कोड स्कैन करें",
    fromDeskOf: "की ओर से",
    poweredBy: "WedSync द्वारा संचालित • प्रीमियम विवाह प्रबंधन"
  }
};
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { generateWhatsAppLink, generateReminderLink, generateWhatsAppMessage, normalizePhone } from "@/lib/whatsapp";
import { generateEmailLink } from "@/lib/email";
import { toast } from "sonner";

function copyToClipboard(text: string) {
  if (typeof window === "undefined") return;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error("Clipboard API failed, using fallback", err);
      fallbackCopyTextToClipboard(text);
    });
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Ensure the textarea is not visible
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (!successful) console.error("Fallback copy failed");
  } catch (err) {
    console.error("Fallback copy error", err);
  }

  document.body.removeChild(textArea);
}

export default function InvitesPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestGroups, setGuestGroups] = useState<{ id: string; name: string }[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

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
    const [weddingRes, guestData, groupRes, funcRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      fetch(`/api/wedding/${weddingId}/guests`).then(res => {
        if (!res.ok) { console.error("Failed to fetch guests:", res.status); return []; }
        return res.json().catch(() => []);
      }),
      supabase.from("guest_groups").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    
    // Guest data is already decrypted server-side
    if (guestData) setGuests(guestData);
    if (groupRes.data) setGuestGroups(groupRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pendingGuests = guests.filter((g: Guest) => !g.invite_sent_at);
  const sentGuests = guests.filter((g: Guest) => g.invite_sent_at);
  const pendingRsvpGuests = guests.filter((g: Guest) => g.invite_sent_at && g.overall_status === "pending");
  const confirmedGuests = guests.filter((g: Guest) => g.overall_status === "confirmed");

  const filteredGuests = (filter === "all" ? guests : filter === "pending" ? pendingGuests : sentGuests)
    .filter((g: Guest) => searchQuery
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
    copyToClipboard(`${baseUrl}/invite/${token}`);
    toast.success("🔗 Invite link copied!");
  }

  async function handleSyncRSVPs() {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/wedding/${weddingId}/sync-call-rsvps`, {
        method: "POST",
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        if (!res.ok) throw new Error("Server communication failed.");
      }

      if (res.ok && data?.success) {
        toast.success(data.message || "RSVPs synced successfully!");
        fetchData();
      } else {
        toast.error(data?.error || "Failed to sync RSVPs");
      }
    } catch (error: any) {
      if (typeof window !== "undefined" && !navigator.onLine || error?.message?.includes("Failed to fetch") || error?.message?.includes("Load failed") || error?.message?.includes("NetworkError")) {
        toast.error("No internet connection. Please check your network.");
      } else {
        toast.error(error?.message || "Error syncing RSVPs");
      }
    } finally {
      setIsSyncing(false);
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
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        if (!response.ok) throw new Error("Server communication failed.");
      }

      if (response.ok && result?.success) {
        toast.success(`🤖 Initiated ${result.successful} AI calls! ${result.failed > 0 ? `${result.failed} failed.` : ""}`, { id: toastId });
        fetchData();
      } else {
        toast.error(`Error: ${result?.error || "Failed to trigger calls"}`, { id: toastId });
      }
    } catch (error: any) {
      if (typeof window !== "undefined" && !navigator.onLine || error?.message?.includes("Failed to fetch") || error?.message?.includes("Load failed") || error?.message?.includes("NetworkError")) {
        toast.error("No internet connection. Please check your network.", { id: toastId });
      } else {
        toast.error(error?.message || "An error occurred while initiating calls", { id: toastId });
      }
    } finally {
      setCallingGuests(false);
    }
  }

  async function handleBulkEmail(targetGuests?: Guest[]) {
    const selectedGuests = targetGuests || pendingGuests;
    if (selectedGuests.length === 0) { toast.error("No guests to email."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "yahoo.co.in"];
    const withEmail = selectedGuests.filter((g: Guest) => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split("@")[1];
      return emailRegex.test(g.email) && allowedDomains.includes(domain);
    });
    const withInvalidEmail = selectedGuests.filter((g: Guest) => {
      if (!g.email) return false;
      const domain = g.email.toLowerCase().split("@")[1];
      return !emailRegex.test(g.email) || !allowedDomains.includes(domain);
    });
    const withoutEmail = selectedGuests.filter((g: Guest) => !g.email);
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

  async function handleUpdateTemplate(templateId: string) {
    if (!wedding) return;
    const { error } = await supabase
      .from("weddings")
      .update({ template_id: templateId })
      .eq("id", wedding.id);

    if (error) {
      toast.error("Failed to update template");
    } else {
      setWedding({ ...wedding, template_id: templateId as any });
      toast.success("Invitation design updated!");
      setIsDesignModalOpen(false);
    }
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  function handleExportForExtension() {
    if (selectedIds.size === 0 || !wedding) return;

    const selectedGuests = guests.filter((g) => selectedIds.has(g.id));
    const data = selectedGuests.map((guest) => ({
      phone: normalizePhone(guest.phone).replace("+", ""),
      message: generateWhatsAppMessage(guest, wedding, functions),
    }));

    copyToClipboard(JSON.stringify(data, null, 2));
    toast.success("📋 JSON copied to clipboard for extension!");
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
    <div className="max-w-7xl mx-auto space-y-6 lg:space-y-12 pb-16 px-1 lg:px-4">
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 lg:gap-6">
        <div className="flex flex-col gap-1 lg:gap-2">
          <h1 className="text-3xl lg:text-5xl font-serif font-bold tracking-tight text-on-surface">Invitations</h1>
          <p className="text-primary font-body text-base lg:text-lg opacity-80">{wedding?.wedding_name || "Sharma-Kapoor Weddings"}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <button
            onClick={() => setIsDesignModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">palette</span>
            Change Design
          </button>
          <button
            onClick={handleSyncRSVPs}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            {isSyncing ? "Syncing..." : "Sync RSVPs"}
          </button>
        </div>
      </header>

      {/* STAT CARDS - Compact Mobile Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-6">
        <div className="col-span-2 lg:col-span-1 bg-surface-container-lowest p-3 lg:p-6 rounded-xl lg:rounded-2xl premium-shadow border-l-[3px] border-primary-container relative overflow-hidden transition-all hover:shadow-md">
          <p className="text-outline text-[9px] lg:text-xs font-black uppercase tracking-wider mb-0.5 lg:mb-2 leading-none">Total Invites</p>
          <h3 className="text-xl lg:text-3xl font-serif font-bold text-on-surface leading-tight">{guests.length} <span className="text-[10px] lg:text-sm font-body font-normal text-outline">Guests</span></h3>
        </div>
        <div className="bg-surface-container-lowest p-3 lg:p-6 rounded-xl lg:rounded-2xl premium-shadow border-l-[3px] border-emerald-500 transition-all hover:shadow-md">
          <p className="text-outline text-[9px] lg:text-xs font-black uppercase tracking-wider mb-0.5 lg:mb-2 leading-none">Sent</p>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xl lg:text-3xl font-serif font-bold text-on-surface leading-tight">{sentGuests.length}</h3>
            {guests.length > 0 && (
              <span className="bg-emerald-50 text-emerald-700 text-[8px] lg:text-[10px] font-black px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-tighter shadow-sm whitespace-nowrap">
                {Math.round((sentGuests.length / guests.length) * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3 lg:p-6 rounded-xl lg:rounded-2xl premium-shadow border-l-[3px] border-amber-400 transition-all hover:shadow-md">
          <p className="text-outline text-[9px] lg:text-xs font-black uppercase tracking-wider mb-0.5 lg:mb-2 leading-none">Not Sent</p>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xl lg:text-3xl font-serif font-bold text-on-surface leading-tight">{pendingGuests.length}</h3>
            {pendingGuests.length > 0 && (
              <span className="bg-amber-50 text-amber-700 text-[8px] lg:text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-100 uppercase tracking-tighter shadow-sm">Pend</span>
            )}
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3 lg:p-6 rounded-xl lg:rounded-2xl premium-shadow border-l-[3px] border-blue-400 transition-all hover:shadow-md">
          <p className="text-outline text-[9px] lg:text-xs font-black uppercase tracking-wider mb-0.5 lg:mb-2 leading-none">Await RSVP</p>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xl lg:text-3xl font-serif font-bold text-on-surface leading-tight">{pendingRsvpGuests.length}</h3>
            {pendingRsvpGuests.length > 0 && (
              <span className="bg-blue-50 text-blue-700 text-[8px] lg:text-[10px] font-black px-1.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-tighter shadow-sm whitespace-nowrap hidden sm:block">Chaser</span>
            )}
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3 lg:p-6 rounded-xl lg:rounded-2xl premium-shadow border-l-[3px] border-emerald-500 transition-all hover:shadow-md">
          <p className="text-outline text-[9px] lg:text-xs font-black uppercase tracking-wider mb-0.5 lg:mb-2 leading-none">Confirmed</p>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xl lg:text-3xl font-serif font-bold text-on-surface leading-tight">{confirmedGuests.length}</h3>
            {confirmedGuests.length > 0 && (
              <span className="material-symbols-outlined text-emerald-500 text-sm lg:text-xl">check_circle</span>
            )}
          </div>
        </div>
      </section>

      {/* ACTION CARDS - Optimized for mobile space */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-8">
        {[
          {
            id: 'reminders',
            title: 'Send Reminders',
            desc: `${pendingRsvpGuests.length} guests pending`,
            icon: 'notifications_active',
            color: 'text-amber-600',
            bg: 'bg-[#FFF9E6]',
            btnText: 'Copy Links',
            action: () => {
              const links = pendingRsvpGuests.map((g) => (wedding ? generateReminderLink(g, wedding) : "")).join("\n");
              copyToClipboard(links);
              toast.success("Reminder links copied!");
            },
            disabled: pendingRsvpGuests.length === 0
          },
          {
            id: 'calls',
            title: 'AI Voice Calls',
            desc: 'Auto-collect RSVPs',
            icon: 'record_voice_over',
            color: 'text-purple-600',
            bg: 'bg-[#F3E8FF]',
            btnText: `Call ${pendingRsvpGuests.length}`,
            action: () => handleAICall(pendingRsvpGuests.map((g) => g.id)),
            disabled: callingGuests || pendingRsvpGuests.length === 0,
            isLoading: callingGuests
          },
          {
            id: 'emails',
            title: 'Email Invites',
            desc: 'Send to email addresses',
            icon: 'mail',
            color: 'text-blue-600',
            bg: 'bg-[#E0F2FE]',
            btnText: 'Email Pending',
            action: () => handleBulkEmail(pendingGuests.filter((g) => !!g.email)),
            disabled: sendingEmails || pendingGuests.length === 0,
            isLoading: sendingEmails
          }
        ].map((item) => (
          <div key={item.id} className={`${item.bg} p-3 lg:p-8 rounded-xl lg:rounded-2xl flex md:flex-col items-center md:items-start gap-3 lg:gap-6 relative overflow-hidden transition-all hover:shadow-md border border-white/50`}>
            <div className={`w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center ${item.color} shadow-sm shrink-0`}>
              <span className="material-symbols-outlined text-xl lg:text-3xl">{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm lg:text-xl font-serif font-bold text-on-surface leading-tight truncate">{item.title}</h4>
              <p className="text-on-surface-variant text-[10px] lg:text-sm font-medium mt-0.5 truncate">{item.desc}</p>
              <button 
                onClick={item.action}
                disabled={item.disabled}
                className="hidden md:block mt-6 w-full py-3 bg-on-surface text-surface text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-30"
              >
                {item.isLoading ? "Loading..." : item.btnText}
              </button>
            </div>
            <button 
              onClick={item.action}
              disabled={item.disabled}
              className="md:hidden px-3 py-1.5 bg-on-surface text-surface text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm active:scale-95 disabled:opacity-30 shrink-0"
            >
              {item.isLoading ? "..." : "GO"}
            </button>
          </div>
        ))}
      </section>

      {/* TABLE */}
      <div className="bg-surface-container-lowest rounded-xl premium-shadow overflow-hidden">
        {/* Filter Tabs + Search - Responsive Stack */}
        <div className="px-4 lg:px-8 py-4 lg:py-6 border-b border-surface-container flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            <h3 className="text-lg lg:text-xl font-serif font-bold text-on-surface">Guest List</h3>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto">
              {(["all", "pending", "sent"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                    filter === f ? "bg-white shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {f} ({f === "all" ? guests.length : f === "pending" ? pendingGuests.length : sentGuests.length})
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guests..."
                className="pl-10 pr-10 py-2.5 bg-slate-50 rounded-xl border border-slate-100 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 text-sm w-full lg:w-64 font-medium outline-none transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            <button className="flex items-center justify-center size-10 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </div>

        {/* Table/Cards Container */}
        <div className="relative">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-surface-container">
            {paginatedGuests.length === 0 ? (
              <div className="px-8 py-12 text-center text-outline font-body">
                No guests found
              </div>
            ) : (
              paginatedGuests.map((guest) => (
                <div key={guest.id} className={`px-3 py-2.5 flex items-center justify-between gap-2 bg-white transition-colors border-b border-slate-50 ${selectedIds.has(guest.id) ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(guest.id)}
                        onChange={() => toggleSelect(guest.id)}
                        style={{ accentColor: "var(--color-primary)" }}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-xs shrink-0">
                        {getInitials(guest.name)}
                      </div>
                    </div>
                    
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-body font-bold text-[13px] text-on-surface truncate leading-tight">{guest.name}</p>
                        {guest.overall_status === "confirmed" ? (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black rounded border border-emerald-100 uppercase tracking-tighter">Confirmed</span>
                        ) : guest.overall_status === "declined" ? (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[8px] font-black rounded border border-red-100 uppercase tracking-tighter">Declined</span>
                        ) : !guest.invite_sent_at ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black rounded border border-amber-100 uppercase tracking-tighter">Not Sent</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black rounded border border-blue-100 uppercase tracking-tighter">Awaiting</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-outline font-medium truncate">{guest.phone || "No phone"}</p>
                        <span className={`px-1 py-0.5 rounded-[4px] text-[7px] font-black uppercase tracking-widest border border-current opacity-60 ${sideColors[guest.side]?.bg || "bg-slate-50 border-slate-200"} ${sideColors[guest.side]?.text || "text-slate-600"}`}>
                          {guest.side}
                        </span>
                        {guest.group_id && (
                          <span className="material-symbols-outlined text-[10px] text-primary/50">family_restroom</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => copyInviteLink(guest.invite_token)} 
                      className="p-1.5 text-slate-400 hover:text-primary transition-all active:scale-90"
                      title="Copy Link"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                    
                    {wedding && (
                      <a
                        href={generateWhatsAppLink(guest, wedding, functions)}
                        target="_blank"
                        rel="noopener"
                        onClick={() => markAsSent(guest.id)}
                        className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                          guest.invite_sent_at
                            ? "text-emerald-600/50"
                            : "text-emerald-500"
                        }`}
                        title="Send WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleAICall([guest.id])}
                      disabled={callingGuests}
                      className="p-1.5 text-purple-600/60 hover:text-purple-600 transition-all active:scale-90"
                      title="AI Voice Call"
                    >
                      <span className="material-symbols-outlined text-[18px]">call</span>
                    </button>

                    {wedding && guest.email && (
                      <button
                        onClick={() => handleBulkEmail([guest])}
                        className="p-1.5 text-blue-600/60 hover:text-blue-600 transition-all active:scale-90"
                        title="Send Email"
                      >
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-8 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredGuests.length && filteredGuests.length > 0}
                      onChange={toggleSelectAll}
                      style={{ accentColor: "var(--color-primary)" }}
                      className="w-4 h-4 rounded cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="px-4 py-4 text-xs font-label uppercase tracking-widest text-outline font-bold">Name</th>
                  <th className="px-4 py-4 text-xs font-label uppercase tracking-widest text-outline font-bold">Status</th>
                  <th className="px-4 py-4 text-xs font-label uppercase tracking-widest text-outline font-bold">Contact</th>
                  <th className="px-4 py-4 text-xs font-label uppercase tracking-widest text-outline font-bold">Side</th>
                  <th className="px-8 py-4 text-xs font-label uppercase tracking-widest text-outline font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {(() => {
                  const rows: React.ReactNode[] = [];
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

                  function InviteRow({ guest, indent }: { guest: Guest; indent?: boolean }) {
                    return (
                      <tr key={guest.id} className={`hover:bg-surface-container transition-colors ${selectedIds.has(guest.id) ? "bg-primary-fixed/20" : ""}`}>
                        <td className="px-8 py-5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(guest.id)}
                            onChange={() => toggleSelect(guest.id)}
                            style={{ accentColor: "var(--color-primary)" }}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className={`px-4 py-5 flex items-center gap-3 ${indent ? "ml-6" : ""}`}>
                          {indent && <span className="text-outline text-sm">└</span>}
                          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-xs shrink-0">
                            {getInitials(guest.name)}
                          </div>
                          <div>
                            <p className="font-body font-bold text-sm text-on-surface">{guest.name}</p>
                            {guest.email && <p className="text-xs text-outline">{guest.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-5 font-body">
                          {guest.overall_status === "confirmed" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 uppercase tracking-tighter">Confirmed</span>
                          ) : guest.overall_status === "declined" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100 uppercase tracking-tighter">Declined</span>
                          ) : !guest.invite_sent_at ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100 uppercase tracking-tighter">Not Sent</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100 uppercase tracking-tighter">Awaiting</span>
                          )}
                        </td>
                        <td className="px-4 py-5 text-sm text-on-surface-variant font-medium">
                          {guest.phone || "—"}
                        </td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize ${sideColors[guest.side]?.bg || "bg-slate-50 border-slate-200"} ${sideColors[guest.side]?.text || "text-slate-600"}`}>
                            {guest.side}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right font-body">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => copyInviteLink(guest.invite_token)} className="p-2 hover:bg-surface-container rounded-lg text-outline hover:text-primary transition-colors" title="Copy Link">
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
                                    ? "hover:bg-emerald-50 text-outline hover:text-emerald-600"
                                    : "bg-emerald-500 text-white active:scale-95 shadow-sm"
                                }`}
                                title="Send WhatsApp"
                              >
                                <span className="material-symbols-outlined text-lg">chat</span>
                              </a>
                            )}
                            <button
                              onClick={() => handleAICall([guest.id])}
                              disabled={callingGuests}
                              className="p-2 hover:bg-purple-50 rounded-lg text-outline hover:text-purple-600 transition-colors"
                              title="AI Voice Call"
                            >
                              <span className="material-symbols-outlined text-lg">call</span>
                            </button>
                            {wedding && guest.email && (
                              <button
                                onClick={() => handleBulkEmail([guest])}
                                className="p-2 hover:bg-blue-50 rounded-lg text-outline hover:text-blue-600 transition-colors"
                                title="Send Email"
                              >
                                <span className="material-symbols-outlined text-lg">mail</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  for (const [groupId, members] of grouped.entries()) {
                    const group = guestGroups.find((g) => g.id === groupId);
                    const isCollapsed = collapsedGroups.has(groupId);
                    const allSent = members.every((m) => m.invite_sent_at);
                    const noneSent = members.every((m) => !m.invite_sent_at);
                    
                    rows.push(
                      <tr key={`group-header-${groupId}`} className="bg-surface-container-low border-b border-surface-container">
                        <td className="px-8 py-4">
                          <input
                            type="checkbox"
                            checked={members.every((m) => selectedIds.has(m.id))}
                            onChange={() => {
                              const next = new Set(selectedIds);
                              const allSelected = members.every((m) => selectedIds.has(m.id));
                              members.forEach((m) => allSelected ? next.delete(m.id) : next.add(m.id));
                              setSelectedIds(next);
                            }}
                            style={{ accentColor: "var(--color-primary)" }}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-4" colSpan={5}>
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
                              <span className="ml-auto text-[11px] font-bold text-emerald-600 flex items-center gap-1">
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

                  ungrouped.forEach((guest) => rows.push(<InviteRow key={guest.id} guest={guest} />));

                  return rows.length > 0 ? rows : (
                    <tr>
                      <td colSpan={6} className="px-8 py-8 text-center text-outline font-body">
                        No guests found
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-8 py-6 bg-surface-container-low flex items-center justify-between">
          <p className="text-xs text-outline font-medium font-body">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length} Guests
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-outline-variant rounded bg-white text-xs font-bold text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 font-body"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-outline-variant rounded bg-white text-xs font-bold text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 font-body"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
            {/* Floating Bulk Action Bar - Polished for mobile */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] lg:w-full lg:max-w-4xl px-0 lg:px-4 z-[100]">
          <div className="bg-slate-900 text-white p-3 lg:p-4 rounded-2xl shadow-2xl flex flex-col lg:flex-row items-center justify-between border border-white/10 gap-3">
            <div className="flex items-center gap-3 pl-2 w-full lg:w-auto border-b lg:border-b-0 border-white/10 pb-2 lg:pb-0">
              <div className="bg-primary size-7 lg:size-8 rounded-full flex items-center justify-center font-black text-xs lg:text-sm text-on-primary shrink-0">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-xs lg:text-sm font-bold font-body">{selectedIds.size} selected</p>
                <p className="text-[9px] lg:text-[10px] text-slate-400 font-medium font-body uppercase tracking-wider">Bulk actions</p>
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto lg:hidden p-1 text-slate-400"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="flex flex-wrap lg:flex-nowrap justify-center gap-1.5 lg:gap-2 w-full lg:w-auto">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="hidden lg:flex px-3 py-2 hover:bg-white/10 text-white rounded-lg font-bold text-xs items-center gap-1.5 transition-all font-body"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Clear
              </button>
              <button
                onClick={() => handleAICall(Array.from(selectedIds))}
                disabled={callingGuests}
                className="flex-1 lg:flex-none px-2 lg:px-3 py-2 bg-purple-600 text-white rounded-lg font-bold text-[10px] lg:text-xs flex items-center justify-center gap-1 lg:gap-1.5 hover:bg-purple-700 transition-all disabled:opacity-50 font-body"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">
                  {callingGuests ? "sync" : "call"}
                </span>
                <span className="truncate">{callingGuests ? "Calling" : `AI Call`}</span>
              </button>
              <button
                onClick={() => handleBulkEmail(guests.filter((g) => selectedIds.has(g.id)))}
                disabled={sendingEmails}
                className="flex-1 lg:flex-none px-2 lg:px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-[10px] lg:text-xs flex items-center justify-center gap-1 lg:gap-1.5 hover:bg-blue-700 transition-all disabled:opacity-50 font-body"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">
                  {sendingEmails ? "sync" : "mail"}
                </span>
                <span className="truncate">{sendingEmails ? "Sending" : `Email`}</span>
              </button>
              <button
                onClick={handleExportForExtension}
                className="flex-1 lg:flex-none px-2 lg:px-3 py-2 bg-amber-500 text-white rounded-lg font-bold text-[10px] lg:text-xs flex items-center justify-center gap-1 lg:gap-1.5 hover:bg-amber-600 transition-all font-body"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">content_paste_go</span>
                <span className="truncate">Export</span>
              </button>
              <button
                onClick={() => markAllAsSent(Array.from(selectedIds))}
                className="flex-1 lg:flex-none px-2 lg:px-3 py-2 bg-primary text-white rounded-lg font-bold text-[10px] lg:text-xs flex items-center justify-center gap-1 lg:gap-1.5 hover:bg-primary/90 transition-all font-body"
              >
                <span className="material-symbols-outlined text-[16px] lg:text-[18px]">mark_email_read</span>
                <span className="truncate">Mark Sent</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Design Selector Modal */}
      {isDesignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl scale-in-95 animate-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Choose Invitation Design</h2>
                <p className="text-sm text-slate-500 mt-1">Select a premium template for your wedding invitation & RSVP</p>
              </div>
              <button onClick={() => setIsDesignModalOpen(false)} className="size-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 md:p-8 overflow-y-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 bg-slate-50/50">
              {[
                { id: 'royal', name: 'Royal Traditional', desc: 'Deep maroon & gold, mandala patterns', preview: '/images/templates/royal.png' },
                { id: 'minimal', name: 'Lavender Elegance', desc: 'Soft purple, wisteria flowers, eucalyptus', preview: '/images/templates/minimal.png' },
                { id: 'floral', name: 'Elegant Floral', desc: 'Watercolor petals, airy aesthetic', preview: '/images/templates/floral.png' },
                { id: 'dark', name: 'Midnight Gala', desc: 'Dark navy, glowing gold, luxury', preview: '/images/templates/dark.png' },
                { id: 'bohemian', name: 'Earthly Bohemian', desc: 'Terracotta, organic leaves, rustic', preview: '/images/templates/bohemian.png' }
              ].map((tpl) => (
                <div 
                  key={tpl.id}
                  onClick={() => handleUpdateTemplate(tpl.id)}
                  className={`group relative flex flex-col bg-white rounded-xl border-2 transition-all cursor-pointer overflow-hidden hover:shadow-xl ${
                    wedding?.template_id === tpl.id ? 'border-primary ring-4 ring-primary/10' : 'border-white hover:border-primary/20'
                  }`}
                >
                  <div className="aspect-square md:aspect-[4/5] overflow-hidden bg-slate-100">
                    <div className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${tpl.preview})` }} />
                    {wedding?.template_id === tpl.id && (
                      <div className="absolute top-3 right-3 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                        <span className="material-symbols-outlined text-base">check</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 md:p-4 border-t border-slate-50">
                    <h3 className="font-bold text-slate-800 text-xs md:text-sm truncate">{tpl.name}</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1 truncate">{tpl.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setIsDesignModalOpen(false)}
                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Email Confirmation Dialog */}
      {showBulkEmailDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkEmailDialog(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-serif font-black text-on-surface mb-2">Send Email Invitations</h3>
            <p className="text-outline text-sm mb-6 font-body">Review before sending</p>
            <div className="space-y-3 mb-6">
              {guestsWithEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                  <div>
                    <p className="font-bold text-sm text-on-surface font-body">{guestsWithEmail.length} guests will receive emails</p>
                    <p className="text-xs text-outline font-body">Valid email addresses</p>
                  </div>
                </div>
              )}
              {guestsWithInvalidEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="material-symbols-outlined text-amber-600">warning</span>
                  <div>
                    <p className="font-bold text-sm text-on-surface font-body">{guestsWithInvalidEmail.length} guests skipped</p>
                    <p className="text-xs text-outline font-body">Invalid or unrecognised email domains</p>
                  </div>
                </div>
              )}
              {guestsWithoutEmail.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-surface-container rounded-lg border border-outline-variant">
                  <span className="material-symbols-outlined text-outline">mail_off</span>
                  <div>
                    <p className="font-bold text-sm text-on-surface font-body">{guestsWithoutEmail.length} guests have no email</p>
                    <p className="text-xs text-outline font-body">Will not be contacted</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkEmailDialog(false)}
                className="flex-1 px-4 py-2 border border-outline-variant rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors font-body"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendEmails}
                disabled={guestsWithEmail.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 font-body"
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
