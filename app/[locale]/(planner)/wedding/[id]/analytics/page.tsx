"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, WeddingFunction, RSVP } from "@/lib/types";
import { bulkSyncWithCRM } from "@/lib/services/crm-sync";
import { sendRSVPReminders } from "@/lib/services/reminders";
import { toast } from "sonner";

export default function AnalyticsPage() {
  const params = useParams();
  const weddingId = params.id as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [weddingRes, funcRes, rsvpRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).single(),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
    ]);
    if (weddingRes.data) setWedding(weddingRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    if (rsvpRes.data) setRsvps(rsvpRes.data);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("rsvp-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `wedding_id=eq.${weddingId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const confirmed = rsvps.filter((r) => r.status === "confirmed").length;
  const declined = rsvps.filter((r) => r.status === "declined").length;
  const pending = rsvps.filter((r) => r.status === "pending").length;
  const totalPax = rsvps.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.total_pax, 0);
  const dietaryBreakdown = {
    veg: rsvps.filter((r) => r.dietary_preference === "veg" && r.status === "confirmed").length,
    jain: rsvps.filter((r) => r.dietary_preference === "jain" && r.status === "confirmed").length,
    nonveg: rsvps.filter((r) => r.dietary_preference === "non-veg" && r.status === "confirmed").length,
  };
  const accommodationNeeded = rsvps.filter((r) => r.needs_accommodation && r.status === "confirmed").length;

  return (
    <div className="space-y-12">
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
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Guests", value: wedding?.total_guests || 0, color: "" },
          { label: "Confirmed", value: confirmed, color: "text-green-600" },
          { label: "Pending", value: pending, color: "text-amber-500" },
          { label: "Declined", value: declined, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm font-medium mb-1">{stat.label}</p>
            <h3 className={`text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </section>

      {/* HERO STAT */}
      <section className="text-center py-10 bg-primary/5 rounded-3xl border border-primary/10">
        <p className="text-primary/70 text-sm font-bold uppercase tracking-[0.2em] mb-2">Confirmed Attendance</p>
        <h1 className="text-6xl md:text-8xl font-black text-primary leading-none">{totalPax} Total PAX</h1>
        <p className="text-slate-600 mt-4 max-w-md mx-auto">
          Estimated guest count across all functions based on latest RSVP responses.
        </p>
      </section>

      {/* FUNCTION BREAKDOWN */}
      <section>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">calendar_today</span>
          Function Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {functions.map((func) => {
            const fr = rsvps.filter((r) => r.function_id === func.id);
            const c = fr.filter((r) => r.status === "confirmed").length;
            const d = fr.filter((r) => r.status === "declined").length;
            const p = fr.filter((r) => r.status === "pending").length;
            const t = c + d + p || 1;
            return (
              <div key={func.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg">{func.name}</h4>
                    <p className="text-slate-500 text-xs">{func.venue_name}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${(c / t) * 100}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${(d / t) * 100}%` }} />
                    <div className="h-full bg-slate-300" style={{ width: `${(p / t) * 100}%` }} />
                  </div>
                  <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-wider">
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
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dietary Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">restaurant_menu</span>
            Dietary Breakdown
          </h4>
          <div className="space-y-4">
            {[
              { label: "Vegetarian", count: dietaryBreakdown.veg, color: "bg-green-500" },
              { label: "Jain", count: dietaryBreakdown.jain, color: "bg-blue-500" },
              { label: "Non-Veg", count: dietaryBreakdown.nonveg, color: "bg-amber-500" },
            ].map((d) => (
              <div key={d.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${d.color}`} />
                  <span className="font-medium">{d.label}</span>
                </div>
                <span className="font-bold">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Accommodation */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center text-center">
          <h4 className="font-bold text-lg mb-6 text-left flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">hotel</span>
            Accommodation
          </h4>
          <div className="py-4">
            <h2 className="text-5xl font-black text-slate-900 mb-2">{accommodationNeeded}</h2>
            <p className="text-xl font-semibold text-primary">Guests need accommodation</p>
          </div>
        </div>
      </section>

      {/* STRATEGIC ACTIONS */}
      <section className="bg-slate-900 rounded-3xl p-8 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-black mb-2">Strategic Operations</h3>
            <p className="text-slate-400 font-medium">Sync data with your CRM and follow up with pending guests.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={async () => {
                const res = await bulkSyncWithCRM(weddingId);
                toast.success(`📤 Synced ${res.synced}/${res.total} guests to CRM (Product 1)`);
              }}
              className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined">sync</span>
              Sync with CRM
            </button>
            <button
              onClick={async () => {
                const res = await sendRSVPReminders(weddingId);
                if (res.success) toast.success(res.message);
              }}
              className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined">notifications_active</span>
              Send Reminders
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
