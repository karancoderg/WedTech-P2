"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { formatDate } from "@/lib/whatsapp";
import { Great_Vibes } from "next/font/google";

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });

export default function InviteLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const t_i18n = useTranslations("Invite");
  const locale = useLocale();

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [hasConfirmedRsvp, setHasConfirmedRsvp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      const { data: tokenData } = await supabase.from("invite_tokens").select("*").eq("token", token).single();
      if (!tokenData) { setError(true); setLoading(false); return; }

      const [weddingRes, guestRes, funcRes, rsvpRes] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", tokenData.wedding_id).single(),
        supabase.from("guests").select("*").eq("id", tokenData.guest_id).single(),
        supabase.from("wedding_functions").select("*").eq("wedding_id", tokenData.wedding_id).in("id", tokenData.function_ids).order("sort_order"),
        supabase.from("rsvps").select("status").eq("guest_id", tokenData.guest_id),
      ]);
      if (weddingRes.data) setWedding(weddingRes.data);
      if (guestRes.data) setGuest(guestRes.data);
      if (funcRes.data) setFunctions(funcRes.data);
      if (rsvpRes.data) {
        setHasConfirmedRsvp(rsvpRes.data.some((r) => r.status === "confirmed"));
      }
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
      bg: "bg-transparent", 
      borderTop: "from-emerald-200 via-emerald-400 to-emerald-200",
      textAccent: "text-emerald-700",
      textPrimary: "text-slate-800",
      textSecondary: "text-slate-500",
      fontDisplay: "font-serif italic",
      fontHeading: greatVibes.className,
      divider: "border-emerald-200",
      button: "bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-200",
      cardBg: "bg-white/70 backdrop-blur-sm border-emerald-100",
      icon: "text-emerald-600",
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

  // Premium dark wedding card design
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto shadow-2xl bg-[#1a1008]">
      
      {/* Rich background texture */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1008] via-[#231508] to-[#1a1008]" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, #c9a84c 1px, transparent 1px), radial-gradient(circle at 80% 80%, #c9a84c 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Top Gold Border */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

      {/* Decorative corner flourishes */}
      <div className="absolute top-4 left-4 opacity-40">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4 C4 4 20 4 44 44" stroke="#c9a84c" strokeWidth="0.5"/>
          <path d="M4 4 C4 4 4 20 44 44" stroke="#c9a84c" strokeWidth="0.5"/>
          <circle cx="4" cy="4" r="2" fill="#c9a84c"/>
          <path d="M12 4 Q8 8 4 12" stroke="#c9a84c" strokeWidth="0.5"/>
          <path d="M4 12 Q4 8 8 4" stroke="#c9a84c" strokeWidth="0.5"/>
        </svg>
      </div>
      <div className="absolute top-4 right-4 opacity-40 scale-x-[-1]">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4 C4 4 20 4 44 44" stroke="#c9a84c" strokeWidth="0.5"/>
          <path d="M4 4 C4 4 4 20 44 44" stroke="#c9a84c" strokeWidth="0.5"/>
          <circle cx="4" cy="4" r="2" fill="#c9a84c"/>
          <path d="M12 4 Q8 8 4 12" stroke="#c9a84c" strokeWidth="0.5"/>
          <path d="M4 12 Q4 8 8 4" stroke="#c9a84c" strokeWidth="0.5"/>
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-8 pt-16 pb-10">
        
        {/* Top ornamental divider */}
        <div className="flex items-center gap-3 mb-8 w-full justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a84c]/60" />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L13.5 8 L20 8 L14.5 12 L16.5 18 L12 14 L7.5 18 L9.5 12 L4 8 L10.5 8 Z" fill="#c9a84c" fillOpacity="0.8"/>
          </svg>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a84c]/60" />
        </div>

        {/* "You are cordially invited" */}
        <p className="text-[#c9a84c]/70 text-[10px] tracking-[0.4em] uppercase mb-3 font-light">
          {t_i18n("invitedTo")}
        </p>

        {/* Couple names */}
        <h1 className={`${greatVibes.className} text-5xl text-[#f0dfa0] leading-tight text-center mb-2`}>
          {wedding.bride_name}
        </h1>
        <div className="flex items-center gap-4 my-1">
          <div className="h-px w-12 bg-[#c9a84c]/40" />
          <span className="text-[#c9a84c] text-xs tracking-[0.3em]">&amp;</span>
          <div className="h-px w-12 bg-[#c9a84c]/40" />
        </div>
        <h1 className={`${greatVibes.className} text-5xl text-[#f0dfa0] leading-tight text-center mb-6`}>
          {wedding.groom_name}
        </h1>

        {/* Wedding subtitle */}
        <p className="text-white/30 text-[9px] tracking-[0.5em] uppercase mb-8">
          {t_i18n("wedding")}
        </p>

        {/* Bottom ornamental divider */}
        <div className="flex items-center gap-3 mb-10 w-full justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a84c]/60" />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2" fill="#c9a84c" fillOpacity="0.8"/>
            <circle cx="8" cy="2" r="1" fill="#c9a84c" fillOpacity="0.5"/>
            <circle cx="8" cy="14" r="1" fill="#c9a84c" fillOpacity="0.5"/>
            <circle cx="2" cy="8" r="1" fill="#c9a84c" fillOpacity="0.5"/>
            <circle cx="14" cy="8" r="1" fill="#c9a84c" fillOpacity="0.5"/>
          </svg>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a84c]/60" />
        </div>

        {/* Event Details */}
        {functions.map((func, i) => (
          <div key={func.id} className="w-full mb-8">
            {i > 0 && <div className="h-px w-full bg-[#c9a84c]/20 my-6" />}
            <div className="text-center space-y-3">
              <p className="text-[#c9a84c] text-[10px] tracking-[0.4em] uppercase font-bold">{func.name}</p>
              <p className="text-white/90 text-xl font-light tracking-wide">{formatDate(func.date)}</p>
              <p className="text-white/50 text-sm tracking-widest">{func.time} {t_i18n("onwards")}</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="material-symbols-outlined text-base text-[#c9a84c]/70">location_on</span>
                <p className="text-white/60 text-sm tracking-wide">{func.venue_name}</p>
              </div>
              {func.maps_url && (
                <a href={func.maps_url} target="_blank" rel="noopener"
                  className="inline-block text-[#c9a84c]/70 text-xs tracking-[0.2em] uppercase underline hover:text-[#c9a84c] transition-colors">
                  {t_i18n("viewOnMaps")} →
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Personalization Card */}
        <div className="w-full border border-[#c9a84c]/20 rounded-lg p-5 text-center mb-8 bg-white/[0.03] backdrop-blur-sm">
          <p className="text-white/70 text-base">
            {t_i18n("dear")} <span className="text-[#f0dfa0] font-semibold">{guest.name}</span>,
          </p>
          <p className="text-white/40 text-xs mt-2 italic leading-relaxed">{t_i18n("requestPleasure")}</p>
        </div>

        {/* RSVP Button */}
        {hasConfirmedRsvp ? (
          <button
            onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
            className="w-full h-14 bg-gradient-to-r from-[#a0722a] via-[#c9a84c] to-[#a0722a] text-[#1a1008] font-bold text-sm rounded-none tracking-[0.3em] uppercase shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            SHOW EVENT PASS
            <span className="material-symbols-outlined text-base">qr_code_2</span>
          </button>
        ) : (
          <button
            onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
            className="w-full h-14 bg-gradient-to-r from-[#a0722a] via-[#c9a84c] to-[#a0722a] text-[#1a1008] font-bold text-sm rounded-none tracking-[0.3em] uppercase shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {t_i18n("rsvpNow")}
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        )}

        {/* Language Switcher */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => router.push(`/en/invite/${token}`)}
            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 border transition-all ${
              locale === 'en' 
                ? 'border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10' 
                : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
            }`}
          >
            English
          </button>
          <button
            onClick={() => router.push(`/hi/invite/${token}`)}
            className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 border transition-all ${
              locale === 'hi' 
                ? 'border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c]/10' 
                : 'border-white/10 text-white/30 hover:border-white/30 hover:text-white/60'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Bottom gold border */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

      {/* Footer */}
      <div className="relative z-10 py-6 flex flex-col items-center border-t border-[#c9a84c]/10 mt-auto">
        <p className="text-white/20 text-[9px] tracking-[0.3em] uppercase">{t_i18n("poweredBy")}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="material-symbols-outlined text-xs text-[#c9a84c]/50">diamond</span>
          <span className="text-[#c9a84c]/50 font-bold text-xs tracking-widest font-serif">WedSync</span>
        </div>
      </div>
    </div>
  );
}
