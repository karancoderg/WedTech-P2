"use client";

import { useEffect, useState, useCallback } from "react";
import { Link } from "@/i18n/routing";
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(editDate) < today) {
      toast.error("Wedding date cannot be in the past");
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
    <div className="relative min-h-screen p-1">
      {/* Premium Background Decoration */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.12] z-0"
        style={{
          backgroundImage: "url('/images/flower.png')",
          backgroundSize: "800px",
          backgroundPosition: "center",
          backgroundRepeat: "repeat",
        }}
      />

      <div className="relative z-10 space-y-8">
      {/* Planner Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 pb-4 gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Overview</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">You have {weddings.length} active weddings in your pipeline</p>
        </div>
      </div>

      {/* My Weddings */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 className="text-base md:text-lg font-bold tracking-tight text-slate-900 uppercase">My Weddings</h2>
          <Link href="/wedding/new">
            <button className="w-full md:w-auto bg-luxury-gradient text-white px-6 py-2.5 rounded-2xl text-sm font-bold shadow-lg premium-shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:brightness-110 flex items-center justify-center gap-2 group relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <span className="material-symbols-outlined text-[22px] group-hover:rotate-90 transition-transform duration-500">add</span>
              <span className="tracking-wide">New Wedding</span>
            </button>
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

                  {/* Theme Image Panel */}
                  {(() => {
                    const dashboardImages = [
                      "/images/dashboard/floral_peonies_watercolor_1774105824990.png",
                      "/images/dashboard/mehndi_hands_ring_1774105891201.png",
                      "/images/dashboard/royal_wedding_rings_1774105805720.png",
                    ];
                    const photoUrl = wedding.cover_photo_url || dashboardImages[index % dashboardImages.length];
                    return (
                      <div
                        className="relative w-full md:w-44 h-28 md:h-auto flex-shrink-0 overflow-hidden"
                        style={{ background: panelColors[index % panelColors.length] }}
                      >
                        <img 
                          src={photoUrl} 
                          alt="Wedding Theme" 
                          className="w-full h-full object-cover mix-blend-multiply opacity-90 transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                    );
                  })()}



                  <div className="flex-1 p-4 md:p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-2 pr-16">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 line-clamp-1">{wedding.wedding_name}</h3>
                        <p className="text-xs md:text-sm text-slate-500 font-medium line-clamp-1">{wedding.bride_name} &amp; {wedding.groom_name}</p>
                      </div>
                      <span className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold rounded-full whitespace-nowrap self-start ${daysColor}`}>
                        {days > 0 ? `${days} Days to go` : days === 0 ? "Today!" : "Past"}
                      </span>
                    </div>

                    {/* Per-Wedding Quick Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3 md:mb-4 p-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
                        <p className="text-xs md:text-sm font-black text-slate-700">{wTotal}</p>
                      </div>
                      <div className="text-center border-x border-slate-200/50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Confirmed</p>
                        <p className="text-xs md:text-sm font-black text-emerald-600">{wConfirmed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending</p>
                        <p className="text-xs md:text-sm font-black text-amber-600">{wGuests.filter(g => g.overall_status === "pending").length}</p>
                      </div>
                    </div>

                    <div className="mt-auto space-y-3 md:space-y-4">
                      <Link href={`/wedding/${wedding.id}/guests`}>
                        <button className="w-full py-2 md:py-2.5 bg-primary hover:bg-primary/90 text-white text-sm md:text-base font-bold rounded-lg transition-all shadow-md shadow-primary/20">
                          Manage Wedding
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
                <input type="date" min={new Date().toISOString().split("T")[0]} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-primary focus:ring-0 transition-colors outline-none" />
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
