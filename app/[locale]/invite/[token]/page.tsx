"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { formatDate } from "@/lib/whatsapp";
import { Great_Vibes, Pinyon_Script, Manrope, Noto_Serif } from "next/font/google";

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });
const pinyonScript = Pinyon_Script({ weight: "400", subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });
const notoSerif = Noto_Serif({ subsets: ["latin"] });

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
  // Premium dark wedding card design
  // -------------------------------------------------------------------------
  // THEME DEFINITIONS
  // -------------------------------------------------------------------------
  const themes: Record<string, any> = {
    royal: {
      bg: "bg-[#570000]",
      accent: "#e9c349",
      textPrimary: "text-white",
      textSecondary: "text-[#e9c349]/70",
      fontHeading: notoSerif.className,
      fontBody: "font-body",
      ornament: (
        <span className="material-symbols-outlined text-[#e9c349] opacity-60" style={{ fontVariationSettings: "'FILL' 1" }}>auto_graph</span>
      ),
      button: "bg-gradient-to-r from-[#735c00] via-[#e9c349] to-[#735c00] text-[#241a00] font-bold rounded-sm tracking-[0.2em]",
      border: "bg-gradient-to-r from-transparent via-[#e9c349]/30 to-transparent",
      customBg: "mandala-pattern"
    },
    minimal: {
      bg: "bg-[#f9f9f9]",
      accent: "#8a4853",
      textPrimary: "text-[#1a1c1c]",
      textSecondary: "text-[#1a1c1c]/60",
      fontHeading: manrope.className + " font-extralight tracking-tighter",
      fontBody: manrope.className,
      ornament: <div className="h-px w-24 bg-[#8a4853]/20" />,
      button: "bg-[#8a4853] text-white rounded-none tracking-widest uppercase font-bold",
      border: "bg-[#8a4853]/10",
      customBg: ""
    },
    floral: {
      bg: "bg-[#faf9f6]",
      accent: "#7b5455",
      textPrimary: "text-[#1a1c1a]",
      textSecondary: "text-[#4f4443]/70",
      fontHeading: notoSerif.className,
      fontBody: manrope.className,
      ornament: (
        <div className="flex gap-2 opacity-40">
          <span className="material-symbols-outlined text-[#7b5455]">filter_vintage</span>
        </div>
      ),
      button: "bg-[#7b5455] text-white rounded-sm shadow-lg tracking-widest uppercase font-bold",
      border: "bg-[#7b5455]/10",
      customBg: "vellum-texture"
    },
    dark: {
      bg: "bg-[#0b141f]",
      accent: "#f2ca50",
      textPrimary: "text-[#dae3f3]",
      textSecondary: "text-[#7f735a]",
      fontHeading: notoSerif.className + " italic",
      fontBody: manrope.className,
      ornament: <div className="size-2 rounded-full bg-[#f2ca50] shadow-[0_0_15px_rgba(242,202,80,0.5)]" />,
      button: "bg-[#f2ca50] text-[#0b141f] rounded-lg shadow-xl font-bold uppercase tracking-widest",
      border: "bg-[#f2ca50]/10",
      customBg: "gold-glow"
    },
    bohemian: {
      bg: "bg-[#fdf9f4]",
      accent: "#914730",
      textPrimary: "text-[#1c1c19]",
      textSecondary: "text-[#54433e]/70",
      fontHeading: pinyonScript.className,
      fontBody: notoSerif.className,
      ornament: <span className="material-symbols-outlined text-[#914730] opacity-40" style={{ fontVariationSettings: "'wght' 100" }}>eco</span>,
      button: "bg-gradient-to-br from-[#914730] to-[#7f735a] text-white rounded-full shadow-lg font-serif tracking-widest",
      border: "bg-[#914730]/10",
      customBg: "paper-texture"
    }
  };

  const currentTheme = themes[wedding.template_id as string] || themes.royal;

  return (
    <div className={`relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] mx-auto shadow-2xl transition-colors duration-700 ${currentTheme.bg}`}>
      
      {/* Background patterns */}
      <div className={`fixed inset-0 z-0 pointer-events-none opacity-10 ${currentTheme.customBg}`} />

      {/* Top Border */}
      <div className={`absolute inset-x-0 top-0 h-[3px] ${currentTheme.border}`} />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center px-8 pt-16 pb-10">
        
        {/* Top Ornament */}
        <div className="flex items-center gap-3 mb-8 w-full justify-center">
          <div className={`h-[1px] flex-1 opacity-20 ${currentTheme.border}`} />
          {currentTheme.ornament}
          <div className={`h-[1px] flex-1 opacity-20 ${currentTheme.border}`} />
        </div>

        {/* Header Text */}
        <p className={`${currentTheme.textSecondary} text-[10px] tracking-[0.4em] uppercase mb-4 font-bold`}>
          {t_i18n("invitedTo")}
        </p>

        {/* Couple Names */}
        <h1 className={`${currentTheme.fontHeading} text-5xl ${currentTheme.textPrimary} leading-tight text-center mb-2`}>
          {wedding.bride_name}
        </h1>
        <div className="flex items-center gap-4 my-2">
          <div className={`h-px w-12 opacity-30 ${currentTheme.border}`} />
          <span className={`${currentTheme.textPrimary} text-xs tracking-[0.3em] font-light opacity-60`}>&amp;</span>
          <div className={`h-px w-12 opacity-30 ${currentTheme.border}`} />
        </div>
        <h1 className={`${currentTheme.fontHeading} text-5xl ${currentTheme.textPrimary} leading-tight text-center mb-8`}>
          {wedding.groom_name}
        </h1>

        {/* Wedding Subtitle */}
        <p className={`${currentTheme.textSecondary} text-[9px] tracking-[0.5em] uppercase mb-12 opacity-50`}>
          {t_i18n("wedding")}
        </p>

        {/* Event Schedule Slider/Stack */}
        <div className="w-full space-y-10 mb-12">
          {functions.map((func, i) => (
            <div key={func.id} className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` } as any}>
              <p className={`${currentTheme.textPrimary} text-[11px] tracking-[0.3em] uppercase font-black mb-3 opacity-80`}>{func.name}</p>
              <h2 className={`${currentTheme.textPrimary} text-2xl font-light mb-1`}>{formatDate(func.date)}</h2>
              <p className={`${currentTheme.textSecondary} text-xs tracking-widest font-medium`}>{func.time} {t_i18n("onwards")}</p>
              
              <div className="flex flex-col items-center mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`material-symbols-outlined text-sm opacity-50`} style={{ color: currentTheme.accent }}>location_on</span>
                  <p className={`${currentTheme.textSecondary} text-sm font-light`}>{func.venue_name}</p>
                </div>
                {func.maps_url && (
                  <a href={func.maps_url} target="_blank" rel="noopener"
                    className={`text-[10px] tracking-[0.2em] uppercase underline opacity-40 hover:opacity-100 transition-opacity`}
                    style={{ color: currentTheme.accent }}>
                    {t_i18n("viewOnMaps")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-12 w-full justify-center">
          <div className={`h-px flex-1 opacity-20 ${currentTheme.border}`} />
          <div className="size-1 rounded-full opacity-40" style={{ backgroundColor: currentTheme.accent }} />
          <div className={`h-px flex-1 opacity-20 ${currentTheme.border}`} />
        </div>

        {/* Personalization */}
        <div className={`w-full border rounded-2xl p-6 text-center mb-10 transition-all ${
           wedding.template_id === 'royal' ? 'bg-white/[0.03] border-white/10' : 
           wedding.template_id === 'dark' ? 'bg-white/[0.05] border-white/10' :
           'bg-black/[0.02] border-black/5'
        }`}>
          <p className={`${currentTheme.textPrimary} text-lg mb-2`}>
            {t_i18n("dear")} <span className="font-bold">{guest.name}</span>,
          </p>
          <p className={`${currentTheme.textSecondary} text-sm italic leading-relaxed`}>{t_i18n("requestPleasure")}</p>
        </div>

        {/* RSVP Primary Button */}
        {hasConfirmedRsvp ? (
          <button
            onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
            className={`w-full h-16 ${currentTheme.button} font-black text-sm tracking-[0.3em] uppercase shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3`}
          >
            SHOW EVENT PASS
            <span className="material-symbols-outlined">qr_code_2</span>
          </button>
        ) : (
          <button
            onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
            className={`w-full h-16 ${currentTheme.button} font-black text-sm tracking-[0.3em] uppercase shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3`}
          >
            {t_i18n("rsvpNow")}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        )}

        {/* Language Selection */}
        <div className="mt-10 flex gap-6">
          {['en', 'hi'].map((l) => (
            <button
              key={l}
              onClick={() => router.push(`/${l}/invite/${token}`)}
              className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                locale === l 
                  ? `border-b-[${currentTheme.accent}] opacity-100` 
                  : 'border-b-transparent opacity-30 hover:opacity-100'
              }`}
            >
              {l === 'en' ? 'English' : 'हिन्दी'}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-10 flex flex-col items-center mt-auto">
        <div className={`h-px w-24 mb-6 opacity-20 ${currentTheme.border}`} />
        <p className={`${currentTheme.textSecondary} text-[9px] tracking-[0.4em] uppercase opacity-40`}>{t_i18n("poweredBy")}</p>
        <div className="flex items-center gap-1.5 mt-2 opacity-30">
          <span className="material-symbols-outlined text-xs" style={{ color: currentTheme.accent }}>diamond</span>
          <span className={`font-bold text-xs tracking-widest font-serif ${currentTheme.textPrimary}`}>WedSync</span>
        </div>
      </footer>

      {/* Bottom Border */}
      <div className={`absolute inset-x-0 bottom-0 h-[3px] ${currentTheme.border}`} />
    </div>
  );
}
