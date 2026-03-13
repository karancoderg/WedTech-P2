"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useParams as useInviteParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { formatDate } from "@/lib/whatsapp";

export default function InviteLandingPage() {
  const params = useParams();
  const token = params.token as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      const { data: tokenData } = await supabase.from("invite_tokens").select("*").eq("token", token).single();
      if (!tokenData) { setError(true); setLoading(false); return; }

      const [weddingRes, guestRes, funcRes] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", tokenData.wedding_id).single(),
        supabase.from("guests").select("*").eq("id", tokenData.guest_id).single(),
        supabase.from("wedding_functions").select("*").eq("wedding_id", tokenData.wedding_id).in("id", tokenData.function_ids).order("sort_order"),
      ]);
      if (weddingRes.data) setWedding(weddingRes.data);
      if (guestRes.data) setGuest(guestRes.data);
      if (funcRes.data) setFunctions(funcRes.data);
      setLoading(false);
    }
    fetchInvite();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <div className="animate-pulse text-primary text-lg font-medium">Loading invitation...</div>
      </div>
    );
  }

  if (error || !wedding || !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <div className="text-center px-4">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">heart_broken</span>
          <p className="text-xl text-slate-600 font-bold">Invitation not found</p>
          <p className="text-sm text-slate-400 mt-2">This invitation link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const themeStyles = {
    floral: {
      bg: "bg-[#fdfbf7]", 
      borderTop: "from-rose-200 via-rose-400 to-rose-200",
      textAccent: "text-rose-700",
      textPrimary: "text-rose-950",
      textSecondary: "text-rose-700/80",
      fontDisplay: "font-serif italic",
      fontHeading: "font-serif",
      divider: "border-rose-200",
      button: "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-200",
      cardBg: "bg-rose-50/50 border-rose-100",
      icon: "text-rose-600",
    },
    royal: {
      bg: "bg-slate-950",
      borderTop: "from-amber-300 via-amber-500 to-amber-300",
      textAccent: "text-amber-400",
      textPrimary: "text-white",
      textSecondary: "text-amber-200/80",
      fontDisplay: "font-serif italic tracking-widest text-amber-200",
      fontHeading: "font-serif",
      divider: "border-amber-500/30",
      button: "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20",
      cardBg: "bg-slate-900 border-amber-500/20",
      icon: "text-amber-500",
    },
    minimal: {
      bg: "bg-white",
      borderTop: "from-slate-200 via-slate-400 to-slate-200",
      textAccent: "text-slate-900",
      textPrimary: "text-slate-900",
      textSecondary: "text-slate-500",
      fontDisplay: "font-sans uppercase tracking-[0.3em] font-light",
      fontHeading: "font-sans font-black tracking-tight",
      divider: "border-slate-200",
      button: "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200",
      cardBg: "bg-slate-50 border-slate-100",
      icon: "text-slate-900",
    }
  };

  const t = themeStyles[wedding?.template_id || 'floral'];

  return (
    <div className={`relative flex min-h-screen w-full flex-col ${t.bg} overflow-x-hidden max-w-[430px] mx-auto shadow-2xl transition-colors duration-500`}>
      {/* Top Decorative Border */}
      <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${t.borderTop}`} />

      {/* Hero Section */}
      <div className="relative pt-12 pb-8 px-6 text-center mt-4">
        <p className={`${t.textAccent} ${t.fontDisplay} text-2xl mb-4 opacity-90`}>
          You&apos;re invited to
        </p>
        <h1 className={`${t.textPrimary} ${t.fontHeading} text-4xl leading-tight mb-8`}>
          {wedding.bride_name} &amp; {wedding.groom_name}&apos;s
          <br />
          <span className="text-2xl font-sans font-light tracking-widest uppercase mt-3 block opacity-80">
            Wedding
          </span>
        </h1>
      </div>

      {/* Event Details */}
      {functions.map((func) => (
        <div key={func.id} className="flex flex-col items-center px-6 text-center space-y-4 mb-8">
          <div className={`inline-block px-4 py-1 border-y ${t.divider} mb-2`}>
            <h4 className={`${t.textAccent} text-lg font-bold tracking-[0.2em] uppercase`}>{func.name}</h4>
          </div>
          <div className="space-y-1">
            <h2 className={`${t.textPrimary} text-xl font-medium tracking-tight`}>{formatDate(func.date)}</h2>
            <p className={`${t.textSecondary} text-base`}>{func.time} onwards</p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className={`material-symbols-outlined text-xl ${t.icon}`}>location_on</span>
            <p className={`${t.textPrimary} text-sm tracking-wide opacity-90`}>{func.venue_name}</p>
          </div>
          {func.maps_url && (
            <a href={func.maps_url} target="_blank" rel="noopener" className={`${t.textAccent} text-sm font-semibold underline opacity-90 hover:opacity-100`}>
              View on Maps →
            </a>
          )}
        </div>
      ))}

      {/* Personalization */}
      <div className="mt-4 px-6">
        <div className={`${t.cardBg} border rounded-xl p-5 text-center shadow-sm`}>
          <p className={`${t.textPrimary} text-lg`}>
            Dear <span className="font-bold">{guest.name}</span>,
          </p>
          <p className={`${t.textSecondary} text-sm mt-2 italic`}>We request the pleasure of your company</p>
        </div>
      </div>

      {/* RSVP Button */}
      <div className="mt-8 px-6 pb-12">
        <Link href={`/invite/${token}/rsvp`}>
          <button className={`w-full h-14 ${t.button} font-bold text-lg rounded-full shadow-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2`}>
            RSVP Now
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </Link>
      </div>

      {/* Footer */}
      <div className={`mt-auto py-6 border-t ${t.divider} flex flex-col items-center`}>
        <p className={`${t.textSecondary} text-[10px] tracking-[0.2em] uppercase opacity-70`}>Powered by</p>
        <div className="flex items-center gap-1 mt-1 opacity-80">
          <span className={`material-symbols-outlined text-xs ${t.icon}`}>diamond</span>
          <span className={`${t.textPrimary} font-bold text-sm tracking-tight font-serif`}>WedSync</span>
        </div>
      </div>
    </div>
  );
}
