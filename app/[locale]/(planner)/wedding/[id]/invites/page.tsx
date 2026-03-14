"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { generateWhatsAppLink, generateReminderLink } from "@/lib/whatsapp";
import { toast } from "sonner";

export default function InvitesPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    const [weddingRes, guestRes, funcRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pendingGuests = guests.filter((g) => !g.invite_sent_at);
  const sentGuests = guests.filter((g) => g.invite_sent_at);
  const pendingRsvpGuests = guests.filter((g) => g.invite_sent_at && g.overall_status === "pending");

  const filteredGuests = filter === "all" ? guests : filter === "pending" ? pendingGuests : sentGuests;
  const totalPages = Math.ceil(filteredGuests.length / pageSize);
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filter]);

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
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
        {/* Filter Tabs */}
        <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between">
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Guest Name</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">Invitation</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider">RSVP Status</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {paginatedGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                        {getInitials(guest.name)}
                      </div>
                      <p className="font-bold text-sm">{guest.name}</p>
                    </div>
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
                      <button
                        onClick={() => copyInviteLink(guest.invite_token)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors"
                        title="Copy Link"
                      >
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
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
