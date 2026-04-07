"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, WeddingFunction, RSVP, Guest } from "@/lib/types";
import { bulkSyncWithCRM } from "@/lib/services/crm-sync";
import { sendRSVPReminders } from "@/lib/services/reminders";
import { toast } from "sonner";

export default function AnalyticsPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [weddingRes, funcRes, rsvpRes, guestRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
      supabase.from("guests").select("*").eq("wedding_id", weddingId),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    if (rsvpRes.data) setRsvps(rsvpRes.data);
    if (guestRes.data) setGuests(guestRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => {
    fetchData();
    const rsvpChannel = supabase
      .channel("rsvp-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `wedding_id=eq.${weddingId}` }, () => fetchData())
      .subscribe();
    const guestChannel = supabase
      .channel("guest-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `wedding_id=eq.${weddingId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(rsvpChannel);
      supabase.removeChannel(guestChannel);
    };
  }, [fetchData, weddingId]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white rounded-xl animate-pulse border border-slate-100" />
        ))}
      </div>
    );
  }

  // Use guests table for accurate per-guest counts
  const totalGuestCount = guests.length;
  const confirmed = guests.filter((g) => g.overall_status === "confirmed").length;
  const declined = guests.filter((g) => g.overall_status === "declined").length;
  const pending = guests.filter((g) => g.overall_status === "pending" || g.overall_status === "partial").length;
  // totalPax = unique headcount: take the max total_pax per guest across their confirmed RSVPs
  // (each guest may confirm for multiple functions, but it's the same party of people)
  const paxByGuest = new Map<string, number>();
  rsvps.filter((r) => r.status === "confirmed").forEach((r) => {
    const current = paxByGuest.get(r.guest_id) || 0;
    if (r.total_pax > current) paxByGuest.set(r.guest_id, r.total_pax);
  });
  const totalPax = Array.from(paxByGuest.values()).reduce((s, v) => s + v, 0);
  let vegCount = 0;
  let jainCount = 0;
  let nonVegCount = 0;
  let notSureCount = 0;
  let accommodationHeadcount = 0;

  rsvps.filter((r) => r.status === "confirmed").forEach((r) => {
    const pref = (r.dietary_preference || "").trim();
    let isGeminiParsed = false;
    let geminiData: any = null;

    if (pref.startsWith("{")) {
      try {
        const parsed = JSON.parse(pref);
        if (parsed._isGeminiParams) {
          isGeminiParsed = true;
          geminiData = parsed;
        }
      } catch (e) {
        // Fallback
      }
    }

    // Accommodation
    if (r.needs_accommodation) {
      if (isGeminiParsed && geminiData.accommodationCount !== undefined) {
        accommodationHeadcount += geminiData.accommodationCount;
      } else {
        accommodationHeadcount += r.total_pax;
      }
    }

    // Dietary
    if (isGeminiParsed) {
      vegCount += geminiData.veg || 0;
      jainCount += geminiData.jain || 0;
      nonVegCount += geminiData.nonveg || 0;
    } else {
      const prefLower = pref.toLowerCase();
      if (!prefLower) {
        notSureCount += r.total_pax;
      } else if (prefLower === "veg" || prefLower === "vegetarian") {
        vegCount += r.total_pax;
      } else if (prefLower === "jain") {
        jainCount += r.total_pax;
      } else if (prefLower === "non-veg" || prefLower === "nonveg") {
        nonVegCount += r.total_pax;
      } else {
        notSureCount += r.total_pax;
      }
    }
  });

  const dietaryBreakdown = {
    veg: vegCount,
    jain: jainCount,
    nonveg: nonVegCount,
    notsure: notSureCount,
  };
  const accommodationNeeded = accommodationHeadcount;

  return (
    <div className="space-y-6 lg:space-y-12 pb-24">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Analytics</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <p className="text-slate-500 text-sm font-medium">Live — Auto updates</p>
          </div>
        </div>
        <a
          href={`/api/export/${weddingId}`}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Export Report
        </a>
      </header>

      {/* TOP METRICS */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {[
          { label: "Total Guests", value: totalGuestCount, color: "" },
          { label: "Confirmed", value: confirmed, color: "text-green-600" },
          { label: "Pending", value: pending, color: "text-amber-500" },
          { label: "Declined", value: declined, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-slate-500 text-xs lg:text-sm font-medium mb-1 truncate">{stat.label}</p>
            <h3 className={`text-xl lg:text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </section>

      {/* HERO STAT */}
      <section className="text-center py-6 lg:py-10 bg-primary/5 rounded-2xl lg:rounded-3xl border border-primary/10 px-4">
        <p className="text-primary/70 text-xs lg:text-sm font-bold uppercase tracking-[0.1em] lg:tracking-[0.2em] mb-2">Confirmed Attendance</p>
        <h1 className="text-4xl md:text-6xl lg:text-8xl font-black text-primary leading-tight lg:leading-none">{totalPax} Total PAX</h1>
        <p className="text-slate-600 mt-2 lg:mt-4 max-w-md mx-auto text-[11px] lg:text-base">
          Estimated guest count across all functions based on latest RSVP responses.
        </p>
      </section>

      {/* FUNCTION BREAKDOWN */}
      <section>
        <h3 className="text-lg lg:text-xl font-bold mb-4 lg:mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">calendar_today</span>
          Function Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-6">
          {functions.map((func) => {
            const fr = rsvps.filter((r) => r.function_id === func.id);
            const c = fr.filter((r) => r.status === "confirmed").length;
            const d = fr.filter((r) => r.status === "declined").length;
            const p = fr.filter((r) => r.status === "pending").length;
            const t = c + d + p || 1;
            return (
              <div key={func.id} className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-3 lg:mb-4">
                  <div>
                    <h4 className="font-bold text-base lg:text-lg">{func.name}</h4>
                    <p className="text-slate-500 text-[10px] lg:text-xs truncate">{func.venue_name}</p>
                  </div>
                </div>
                <div className="space-y-3 lg:space-y-4">
                  <div className="flex h-2 lg:h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${(c / t) * 100}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${(d / t) * 100}%` }} />
                    <div className="h-full bg-slate-300" style={{ width: `${(p / t) * 100}%` }} />
                  </div>
                  <div className="grid grid-cols-3 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">
                    <div className="text-green-600 text-center">{Math.round((c / t) * 100)}% Conf</div>
                    <div className="text-red-500 text-center">{Math.round((d / t) * 100)}% Decl</div>
                    <div className="text-slate-400 text-center">{Math.round((p / t) * 100)}% Pend</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* DATA INSIGHTS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Dietary Breakdown */}
        <div className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="font-bold text-base lg:text-lg mb-4 lg:mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">restaurant_menu</span>
            Dietary Breakdown
          </h4>
          <div className="space-y-2 lg:space-y-4">
            {[
              { label: "Vegetarian", count: dietaryBreakdown.veg, color: "bg-green-500" },
              { label: "Jain", count: dietaryBreakdown.jain, color: "bg-blue-500" },
              { label: "Non-Veg", count: dietaryBreakdown.nonveg, color: "bg-amber-500" },
              { label: "Not Sure", count: dietaryBreakdown.notsure, color: "bg-slate-300" },
            ].map((d) => (
              <div key={d.label} className="flex items-center justify-between p-2 lg:p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full ${d.color}`} />
                  <span className="font-medium text-[11px] lg:text-base">{d.label}</span>
                </div>
                <span className="font-bold text-sm lg:text-base">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Accommodation */}
        <div className="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center text-center">
          <h4 className="font-bold text-base lg:text-lg mb-4 lg:mb-6 text-left flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl lg:text-2xl">hotel</span>
            Accommodation
          </h4>
          <div className="py-2 lg:py-4">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-1 lg:mb-2">{accommodationNeeded}</h2>
            <p className="text-sm lg:text-xl font-semibold text-primary">Guests need accommodation</p>
          </div>
        </div>
      </section>

      {/* STRATEGIC ACTIONS */}
      <section className="bg-slate-900 rounded-2xl lg:rounded-3xl p-5 lg:p-8 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl lg:text-2xl font-black mb-1 lg:mb-2">Strategic Operations</h3>
            <p className="text-slate-400 font-medium text-[11px] lg:text-base">Sync data with your CRM and follow up with pending guests.</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 lg:gap-4">
            <button
              onClick={async () => {
                const res = await bulkSyncWithCRM(weddingId);
                toast.success(`📤 Synced ${res.synced}/${res.total} guests to CRM (Product 1)`);
              }}
              className="w-full sm:w-auto px-5 py-3 lg:px-8 lg:py-4 bg-white text-slate-900 rounded-xl lg:rounded-2xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-xs lg:text-base"
            >
              <span className="material-symbols-outlined text-lg">sync</span>
              Sync with CRM
            </button>
            <button
              onClick={async () => {
                const res = await sendRSVPReminders(weddingId);
                if (res.success) toast.success(res.message);
              }}
              className="w-full sm:w-auto px-5 py-3 lg:px-8 lg:py-4 bg-primary text-white rounded-xl lg:rounded-2xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-xs lg:text-base"
            >
              <span className="material-symbols-outlined text-lg">notifications_active</span>
              Send Reminders
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
