"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Html5QrcodeScanner } from "html5-qrcode";
import type { Guest, RSVP, WeddingFunction, Wedding } from "@/lib/types";
import { toast } from "sonner";

export default function CheckInPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupGuests, setGroupGuests] = useState<Guest[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const [weddingRes, funcRes, guestRes, rsvpRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    if (rsvpRes.data) setRsvps(rsvpRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      async (decodedText) => {
        scanner.pause(true);
        const guest = guests.find((g) => g.invite_token === decodedText);
        if (guest) {
          if (guest.group_id) {
            const family = guests.filter((g) => g.group_id === guest.group_id);
            setGroupGuests(family);
            // Auto-select those who are confirmed but not fully checked-in to all their invited functions
            const toCheckIn = family.filter(f => {
              const guestRsvps = rsvps.filter(r => r.guest_id === f.id && r.status === "confirmed");
              const isCheckedIn = guestRsvps.length > 0 && guestRsvps.every(r => r.checked_in);
              return guestRsvps.length > 0 && !isCheckedIn;
            }).map(f => f.id);
            setSelectedGroupIds(new Set(toCheckIn));
            setShowGroupDialog(true);
            scanner.clear();
            setShowScanner(false);
            return;
          }

          const guestRsvps = rsvps.filter((r) => r.guest_id === guest.id && r.status === "confirmed");
          const isCheckedIn = guestRsvps.length > 0 && guestRsvps.every(r => r.checked_in);

          if (isCheckedIn) {
            toast.info(`${guest.name} is already checked in.`);
            scanner.resume();
            return;
          }

          // Check in to all confirmed functions
          if (guestRsvps.length > 0) {
            for (const rsvp of guestRsvps) {
              await supabase.from("rsvps").upsert({
                id: rsvp.id,
                wedding_id: weddingId,
                guest_id: guest.id,
                function_id: rsvp.function_id,
                status: "confirmed",
                total_pax: rsvp.total_pax || 1,
                checked_in: true,
                checked_in_at: new Date().toISOString(),
              });
            }
          } else {
             toast.error(`Guest has no confirmed RSVPs.`);
             scanner.resume();
             return;
          }

          setLastCheckedIn(guest.id);
          toast.success(`📷 Scanned: ${guest.name} checked in!`);
          scanner.clear();
          setShowScanner(false);
          fetchData();
          setTimeout(() => setLastCheckedIn(null), 3000);
        } else {
          toast.error("Invalid QR Code.");
          scanner.resume();
        }
      },
      (error) => { /* Ignore frequent scan errors */ }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [showScanner, guests, rsvps, weddingId, fetchData]);

  async function handleCheckIn(guestId: string) {
    const guestRsvps = rsvps.filter((r) => r.guest_id === guestId && r.status === "confirmed");
    if (guestRsvps.length > 0) {
      for (const rsvp of guestRsvps) {
        await supabase.from("rsvps").update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("id", rsvp.id);
      }
    }
    setLastCheckedIn(guestId);
    toast.success("✅ Guest checked in!");
    fetchData();
    setTimeout(() => setLastCheckedIn(null), 3000);
  }

  async function handleBulkCheckIn() {
    const ids = Array.from(selectedGroupIds);
    if (ids.length === 0) return;

    for (const guestId of ids) {
      const guestRsvps = rsvps.filter((r) => r.guest_id === guestId && r.status === "confirmed");
      for (const rsvp of guestRsvps) {
        await supabase.from("rsvps").upsert({
          id: rsvp.id,
          wedding_id: weddingId,
          guest_id: guestId,
          function_id: rsvp.function_id,
          status: "confirmed",
          total_pax: rsvp.total_pax || 1,
          checked_in: true,
          checked_in_at: new Date().toISOString(),
        });
      }
    }

    toast.success(`✅ ${ids.length} entries checked in!`);
    setShowGroupDialog(false);
    fetchData();
  }

  function toggleGuestSelection(id: string) {
    const next = new Set(selectedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroupIds(next);
  }

  const filteredGuests = guests.filter((g) =>
    searchQuery ? g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone.includes(searchQuery) : true
  );

  const confirmedGuestsWithRsvps = guests.filter(g => {
      const gRsvps = rsvps.filter(r => r.guest_id === g.id && r.status === "confirmed");
      return gRsvps.length > 0;
  });

  const checkedInCount = confirmedGuestsWithRsvps.filter((g) => {
      const gRsvps = rsvps.filter(r => r.guest_id === g.id && r.status === "confirmed");
      return gRsvps.every(r => r.checked_in);
  }).length;
  
  const confirmedCount = confirmedGuestsWithRsvps.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-slate-100" />
        ))}
      </div>
    );
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Master Check-In</h2>
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          Scan QR
        </button>
      </header>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col gap-1">
          <p className="text-emerald-700 font-semibold text-sm">Checked In</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-black text-emerald-900">{checkedInCount}</h3>
            {confirmedCount > 0 && (
              <span className="text-emerald-600 text-sm font-bold mb-1">
                {Math.round((checkedInCount / confirmedCount) * 100)}% of confirmed
              </span>
            )}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex flex-col gap-1">
          <p className="text-amber-700 font-semibold text-sm">Yet to Arrive</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-black text-amber-900">{confirmedCount - checkedInCount}</h3>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative group">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary">search</span>
        <input
          className="w-full bg-white border-2 border-slate-100 focus:border-primary focus:ring-0 rounded-2xl py-4 pl-12 pr-4 text-base font-medium transition-all shadow-sm placeholder:text-slate-400"
          placeholder="Search guest name or phone..."
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* GUEST LIST */}
      <div className="flex flex-col gap-4">
        {filteredGuests.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No guests found</p>
        ) : (
          filteredGuests.map((guest) => {
            const guestRsvps = rsvps.filter((r) => r.guest_id === guest.id && r.status === "confirmed");
            const isCheckedIn = guestRsvps.length > 0 && guestRsvps.every(r => r.checked_in);
            const isJustCheckedIn = lastCheckedIn === guest.id;
            const hasConfirmed = guestRsvps.length > 0;
            const primaryRsvp = guestRsvps[0];

            return (
              <div
                key={guest.id}
                className={`bg-white p-5 rounded-2xl flex items-center justify-between group transition-all ${isJustCheckedIn
                    ? "border border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-row-highlight"
                    : isCheckedIn
                      ? "border border-emerald-200 opacity-60"
                      : "border border-slate-100 shadow-sm hover:border-primary/30"
                  }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-lg">
                    {getInitials(guest.name)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 flex-1 items-center gap-4">
                    <div className="col-span-1">
                      <h4 className="font-bold text-slate-900">{guest.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">{guest.phone}</p>
                    </div>
                    <div className="col-span-1 flex flex-col gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-tight ${hasConfirmed
                            ? "bg-emerald-100 text-emerald-700"
                            : guest.overall_status === "declined"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {hasConfirmed ? "Confirmed" : guest.overall_status}
                      </span>
                      {hasConfirmed && (
                        <p className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">group</span>
                          {primaryRsvp?.total_pax || 1} {primaryRsvp?.total_pax === 1 ? "Guest" : "Guests"}
                        </p>
                      )}
                    </div>
                    <div className="col-span-1 hidden md:flex flex-col gap-0.5">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Dietary</p>
                      <p className="text-xs text-slate-700 font-medium capitalize">
                        {primaryRsvp?.dietary_preference || "—"}
                      </p>
                    </div>
                    {isCheckedIn && (
                      <div className="col-span-1 hidden md:flex flex-col gap-0.5">
                        <p className="text-emerald-600 font-bold text-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          Checked In
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  {isCheckedIn ? (
                    <span className="text-emerald-600 font-bold text-sm hidden md:block">
                      {isJustCheckedIn ? "Recently Added" : ""}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(guest.id)}
                      disabled={!hasConfirmed}
                      className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        hasConfirmed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {hasConfirmed ? "Check In" : "No RSVP"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* GROUP CHECK-IN MODAL */}
      {showGroupDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">Family Check-In</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">Select members to admit</p>
              </div>
              <button onClick={() => setShowGroupDialog(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {groupGuests.map((g) => {
                const guestRsvps = rsvps.filter(rsvp => rsvp.guest_id === g.id && rsvp.status === "confirmed");
                const isSelected = selectedGroupIds.has(g.id);
                const alreadyIn = guestRsvps.length > 0 && guestRsvps.every(r => r.checked_in);
                const hasConfirmed = guestRsvps.length > 0;

                return (
                  <label key={g.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${alreadyIn ? "bg-slate-50 border-transparent opacity-50" :
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 hover:border-primary/20"
                    }`}>
                    <input
                      type="checkbox"
                      className="size-5 rounded-lg text-primary border-slate-300 focus:ring-primary disabled:opacity-50"
                      checked={isSelected || alreadyIn}
                      disabled={alreadyIn || !hasConfirmed}
                      onChange={() => toggleGuestSelection(g.id)}
                    />
                    <div className="flex-1">
                      <p className={`font-bold ${alreadyIn ? "text-slate-400" : "text-slate-900"}`}>{g.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${hasConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}>
                          {hasConfirmed ? "Confirmed" : "No RSVP"}
                        </span>
                        {alreadyIn && <span className="text-[10px] font-black text-emerald-600 uppercase">Already Admitted</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowGroupDialog(false)}
                className="flex-1 py-4 text-slate-600 font-bold text-sm hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCheckIn}
                className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Check In Selection ({selectedGroupIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowScanner(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">Scan Event Pass</h3>
              <button onClick={() => setShowScanner(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center">
              <div id="reader" className="w-full bg-slate-50 rounded-2xl overflow-hidden shadow-inner" />
              <p className="mt-5 text-center text-sm font-semibold text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">videocam</span>
                Point your camera at the guest's QR code
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
