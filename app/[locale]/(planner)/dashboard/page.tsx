"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import type { Wedding, RSVP, Guest } from "@/lib/types";
import { daysUntil } from "@/lib/whatsapp";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user } = useUser();
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingWedding, setEditingWedding] = useState<Wedding | null>(null);
  const [editName, setEditName] = useState("");
  const [editBride, setEditBride] = useState("");
  const [editGroom, setEditGroom] = useState("");
  const [editDate, setEditDate] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: weddingData } = await supabase
      .from("weddings")
      .select("*")
      .eq("planner_id", user.id)
      .order("created_at", { ascending: false });

    if (weddingData) {
      setWeddings(weddingData);
      if (weddingData.length > 0) {
        const ids = weddingData.map((w) => w.id);
        const [{ data: rsvpData }, { data: guestData }] = await Promise.all([
          supabase.from("rsvps").select("*").in("wedding_id", ids),
          supabase.from("guests").select("id, wedding_id, overall_status").in("wedding_id", ids)
        ]);
        if (rsvpData) setRsvps(rsvpData);
        if (guestData) setGuests(guestData as Guest[]);
      } else {
        setRsvps([]);
        setGuests([]);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDeleteWedding(id: string) {
    if (!confirm("Are you sure you want to delete this wedding? This will delete all guests, functions, and RSVPs. This action cannot be undone.")) return;
    setLoading(true);
    await supabase.from("weddings").delete().eq("id", id);
    toast.success("Wedding deleted successfully");
    fetchData();
  }

  async function handleUpdateWedding() {
    if (!editingWedding || !editName || !editDate) {
      toast.error("Please fill required fields");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("weddings").update({
      wedding_name: editName,
      bride_name: editBride,
      groom_name: editGroom,
      wedding_date: editDate
    }).eq("id", editingWedding.id);

    if (error) { toast.error("Failed to update wedding"); }
    else { toast.success("Wedding updated successfully"); }

    setEditingWedding(null);
    fetchData();
  }

  function openEditModal(w: Wedding) {
    setEditingWedding(w);
    setEditName(w.wedding_name);
    setEditBride(w.bride_name);
    setEditGroom(w.groom_name);
    setEditDate(w.wedding_date);
  }

  if (loading && weddings.length === 0) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl animate-pulse border border-slate-100 h-24" />
          ))}
        </div>
      </div>
    );
  }

  const totalGuests = guests.length;
  // Compute total confirmed from guests table instead of rsvps for accuracy
  const totalConfirmed = guests.filter((g) => g.overall_status === "confirmed").length;
  const totalPending = guests.filter((g) => g.overall_status === "pending").length;

  const panelColors = ["#EDE8E1", "#E8EDF2", "#EDE8ED", "#E5EDEA"];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <p className="text-sm font-medium text-slate-500">Active Weddings</p>
          <p className="text-3xl font-black mt-2">{weddings.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <p className="text-sm font-medium text-slate-500">Total Guests</p>
          <p className="text-3xl font-black mt-2">{totalGuests.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <p className="text-sm font-medium text-slate-500">Confirmed</p>
          <p className="text-3xl font-black mt-2 text-emerald-600">{totalConfirmed}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <p className="text-sm font-medium text-slate-500">Pending RSVPs</p>
          <p className="text-3xl font-black mt-2 text-amber-600">{totalPending}</p>
        </div>
      </div>

      {/* My Weddings */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 uppercase">My Weddings</h2>
          <Link href="/wedding/new" className="text-sm font-semibold text-primary hover:underline">
            + New Wedding
          </Link>
        </div>

        {weddings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">celebration</span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No weddings yet</h3>
            <p className="text-slate-500 mb-6">Create your first wedding to get started</p>
            <Link href="/wedding/new">
              <button className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
                <span className="material-symbols-outlined text-sm mr-2 align-middle">add</span>
                Create Wedding
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {weddings.map((wedding, index) => {
              const days = daysUntil(wedding.wedding_date);

              // Dynamic stats from guests table
              const wGuests = guests.filter(g => g.wedding_id === wedding.id);
              const wTotal = wGuests.length || 1;
              const wConfirmed = wGuests.filter(g => g.overall_status === "confirmed").length;
              const wDeclined = wGuests.filter(g => g.overall_status === "declined").length;
              const progress = Math.round(((wConfirmed + wDeclined) / wTotal) * 100);

              const daysColor = days <= 14 ? "bg-emerald-50 text-emerald-700" : days <= 45 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";

              return (
                <div key={wedding.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row relative group">

                  {/* Action Menu (Hover) */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1 flex gap-1 shadow-sm border border-white">
                    <button onClick={() => openEditModal(wedding)} className="p-1.5 text-slate-500 hover:text-primary hover:bg-white rounded-md transition-all" title="Edit Wedding">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteWedding(wedding.id)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-white rounded-md transition-all" title="Delete Wedding">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  {/* SVG Illustration Panel */}
                  {(() => {
                    const color = "rgba(100,85,70,0.25)";
                    const illustrations = [
                      // 0: Interlocking wedding rings
                      <svg key="rings" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="28" cy="36" r="16" stroke={color} strokeWidth="2"/>
                        <circle cx="44" cy="36" r="16" stroke={color} strokeWidth="2"/>
                        <path d="M24 28 Q28 24 32 28" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        <path d="M40 28 Q44 24 48 28" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                      </svg>,
                      // 1: Simple floral bloom
                      <svg key="floral" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="36" cy="36" r="5" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="36" cy="20" rx="5" ry="9" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="36" cy="52" rx="5" ry="9" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="20" cy="36" rx="9" ry="5" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="52" cy="36" rx="9" ry="5" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="24" cy="24" rx="5" ry="9" transform="rotate(45 24 24)" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="48" cy="48" rx="5" ry="9" transform="rotate(45 48 48)" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="48" cy="24" rx="5" ry="9" transform="rotate(-45 48 24)" stroke={color} strokeWidth="1.5"/>
                        <ellipse cx="24" cy="48" rx="5" ry="9" transform="rotate(-45 24 48)" stroke={color} strokeWidth="1.5"/>
                      </svg>,
                      // 2: Tiered wedding cake
                      <svg key="cake" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="18" y="44" width="36" height="14" rx="1" stroke={color} strokeWidth="1.5"/>
                        <rect x="24" y="32" width="24" height="14" rx="1" stroke={color} strokeWidth="1.5"/>
                        <rect x="29" y="22" width="14" height="12" rx="1" stroke={color} strokeWidth="1.5"/>
                        <line x1="36" y1="22" x2="36" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="36" cy="14" r="2.5" stroke={color} strokeWidth="1.5"/>
                        <path d="M22 44 Q25 40 28 44" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none"/>
                        <path d="M34 32 Q36 28 38 32" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none"/>
                      </svg>,
                      // 3: Laurel wreath
                      <svg key="laurel" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M36 52 C36 52 16 44 16 28 C16 20 22 14 28 16 C30 16 32 18 32 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        <path d="M36 52 C36 52 56 44 56 28 C56 20 50 14 44 16 C42 16 40 18 40 20" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        <ellipse cx="22" cy="22" rx="5" ry="3" transform="rotate(-30 22 22)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <ellipse cx="18" cy="32" rx="5" ry="3" transform="rotate(-10 18 32)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <ellipse cx="20" cy="42" rx="5" ry="3" transform="rotate(15 20 42)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <ellipse cx="50" cy="22" rx="5" ry="3" transform="rotate(30 50 22)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <ellipse cx="54" cy="32" rx="5" ry="3" transform="rotate(10 54 32)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <ellipse cx="52" cy="42" rx="5" ry="3" transform="rotate(-15 52 42)" stroke={color} strokeWidth="1.2" fill="none"/>
                        <path d="M30 54 Q36 58 42 54" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                      </svg>,
                    ];
                    return (
                      <div
                        className="relative w-full md:w-44 h-44 md:h-auto flex-shrink-0 flex items-center justify-center"
                        style={{ background: panelColors[index % panelColors.length] }}
                      >
                        {illustrations[index % illustrations.length]}
                      </div>
                    );
                  })()}


                  <div className="flex-1 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-2 pr-16">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{wedding.wedding_name}</h3>
                        <p className="text-slate-500 font-medium">{wedding.bride_name} &amp; {wedding.groom_name}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${daysColor}`}>
                        {days > 0 ? `${days} Days to go` : days === 0 ? "Today!" : "Past"}
                      </span>
                    </div>
                    <div className="mt-auto pt-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500">RSVP Progress ({wConfirmed}/{wTotal} Confirmed)</span>
                          <span className="text-slate-900">{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <Link href={`/wedding/${wedding.id}/guests`}>
                        <button className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all shadow-md shadow-primary/20">
                          Open Dashboard
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {rsvps.length > 0 && (
        <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">RECENT ACTIVITY</h2>
          </div>
          <div className="space-y-6">
            {rsvps
              .filter((r) => r.responded_at)
              .sort((a, b) => new Date(b.responded_at!).getTime() - new Date(a.responded_at!).getTime())
              .slice(0, 5)
              .map((rsvp) => {
                const wedding = weddings.find((w) => w.id === rsvp.wedding_id);
                const iconClass = rsvp.status === "confirmed"
                  ? "bg-emerald-100 text-emerald-600"
                  : rsvp.status === "declined"
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-600";
                const icon = rsvp.status === "confirmed" ? "check_circle" : rsvp.status === "declined" ? "cancel" : "pending";
                const timeAgo = getTimeAgo(rsvp.responded_at!);

                return (
                  <div key={rsvp.id} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconClass}`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        Guest {rsvp.status === "confirmed" ? "confirmed" : "declined"} attendance
                        {rsvp.total_pax > 1 ? ` (${rsvp.total_pax} guests)` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {wedding?.wedding_name} • {timeAgo}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Edit Wedding Modal */}
      {editingWedding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditingWedding(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">Edit Wedding</h3>
              <button onClick={() => setEditingWedding(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wedding Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-primary focus:ring-0 transition-colors outline-none" placeholder="e.g. #AnantMeetsRadhika" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bride</label>
                  <input type="text" value={editBride} onChange={(e) => setEditBride(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-primary focus:ring-0 transition-colors outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Groom</label>
                  <input type="text" value={editGroom} onChange={(e) => setEditGroom(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-primary focus:ring-0 transition-colors outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-primary focus:ring-0 transition-colors outline-none" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button disabled={loading} onClick={() => setEditingWedding(null)} className="flex-1 py-3 font-bold text-slate-600 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">Cancel</button>
              <button disabled={loading} onClick={handleUpdateWedding} className="flex-1 py-3 font-bold text-white bg-primary rounded-xl shadow-md hover:bg-primary/90 transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
