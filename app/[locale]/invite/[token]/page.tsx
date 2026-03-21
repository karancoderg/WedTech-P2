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

  // ── LAVENDER ELEGANCE LAYOUT (Purple Floral Watercolor) ────────────────
  if (wedding.template_id === 'minimal') {
    return (
      <div className="min-h-screen w-full bg-[#f6f4fa] flex justify-center relative overflow-hidden">
        
        

        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] bg-[#ffffff] shadow-2xl z-50">
          
          {/* Watercolor Base Layer */}
          <div className="absolute inset-x-0 top-0 bottom-0 z-0 pointer-events-none flex justify-center bg-[#f8f0f2]">
            <div className="w-full max-w-[430px] relative h-full">
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-[70px] mix-blend-multiply" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-100/60 rounded-full blur-[70px] mix-blend-multiply" />
               <div className="absolute top-1/2 left-0 w-48 h-48 bg-blue-100/40 rounded-full blur-[80px] mix-blend-multiply" />
               
               {/* Transformed Florals for the Mobile Card Borders */}
               <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-top" />
               <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-bottom" />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center flex-1 px-8 pt-[220px] pb-[380px] text-center">
            
            <div className="mb-2 w-full text-center mt-6">
              <p className="font-serif text-[8px] sm:text-[10px] tracking-[0.1em] text-[#4a2e6b] font-bold">MARRIAGE IS A SUNNAH OF PROPHET MUHAMMAD S.A.W</p>
              <p className="font-serif text-[8px] sm:text-[10px] tracking-[0.1em] text-[#4a2e6b] font-bold">(SUNAN IBN MAJAH)</p>
            </div>

            <p className="font-serif text-xs md:text-sm tracking-[0.2em] text-[#4a2e6b] uppercase leading-relaxed mt-4 mb-4">
              Y O U  A R E  C O R D I A L L Y<br/>I N V I T E D  T O  T H E<br/>W E D D I N G  O F
            </p>

            <div className="relative w-full flex flex-col items-center select-none pt-4 pb-6 mt-4">
              <span className={`${greatVibes.className} text-6xl text-[#4a2e6b] mb-1`}>{wedding.bride_name}</span>
              <span className={`${greatVibes.className} text-4xl text-[#2a173d] my-1`}>With</span>
              <span className={`${greatVibes.className} text-6xl text-[#4a2e6b] mt-1`}>{wedding.groom_name}</span>
            </div>

            {/* Event Functions */}
            <div className="w-full space-y-16">
              {functions.map((func) => {
                const dateObj = new Date(func.date);
                const month = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"][dateObj.getMonth()];
                const dayName = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][dateObj.getDay()];
                const dayNum = dateObj.getDate();
                const year = dateObj.getFullYear();
                const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                  <div key={func.id} className="w-full flex justify-center flex-col items-center animate-fade-in-up">
                    <p className="font-bold text-[10px] tracking-[0.3em] uppercase text-purple-900/60 mb-6">{func.name}</p>

                    {/* Highly stylized Date Block */}
                    <p className="text-sm font-bold tracking-[0.3em] uppercase text-slate-700 mb-3">{month}</p>
                    <div className="flex items-center justify-center w-full max-w-[280px]">
                      <div className="flex-1 border-t border-amber-600/30"></div>
                      <div className="flex items-center mx-2 space-x-4">
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-600">{dayName}</span>
                        <span className="text-5xl font-light text-slate-700 text-purple-900/80 leading-none pb-1">{dayNum}</span>
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-600">AT {time}</span>
                      </div>
                      <div className="flex-1 border-t border-amber-600/30"></div>
                    </div>
                    <p className="text-sm font-bold tracking-[0.3em] uppercase text-slate-700 mt-4">{year}</p>

                    {/* Venue */}
                    <div className="mt-8 space-y-1 w-full max-w-[280px]">
                      <p className="font-bold text-base text-slate-800">{func.venue_name}</p>
                      <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{func.venue_address}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3 mt-12 animate-fade-in-up" style={{ animationDelay: '0.9s' }}>
              {!hasConfirmedRsvp ? (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
                  className="w-full bg-[#f6f4fa] hover:bg-purple-100 text-purple-900 font-bold tracking-[0.2em] py-4 rounded-xl shadow-[0_4px_15px_-5px_rgba(100,50,150,0.1)] transition-all uppercase text-xs"
                >
                  {t_i18n("navRSVP")}
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
                  className="w-full py-4 rounded-xl border-2 border-purple-200/50 text-purple-800 font-bold uppercase tracking-[0.15em] text-xs hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code</span>
                  Show Event Pass
                </button>
              )}
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  // ── SAPPHIRE & GOLD LAYOUT (Midnight Gala) ────────────────
  if (wedding.template_id === 'dark') {
    return (
      <div className="min-h-screen w-full bg-[#e8e9ea] flex justify-center relative overflow-hidden">
        
        {/* Extra Laptop Background (Removed) */}

        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] bg-[#051c2c] shadow-[0_0_40px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
          
          {/* Inner Thin Gold Rectangular Broken Border */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Top */}
            <div className="absolute top-[24px] left-[110px] right-[24px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
            {/* Right */}
            <div className="absolute top-[24px] bottom-[110px] right-[24px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
            {/* Bottom */}
            <div className="absolute bottom-[24px] left-[24px] right-[110px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
            {/* Left */}
            <div className="absolute top-[110px] bottom-[24px] left-[24px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
          </div>

          {/* Intricate Hand-drawn Gold Vector Line Art Florals */}
          <div className="absolute top-0 left-0 z-20 pointer-events-none opacity-90 select-none overflow-hidden w-full h-full">
             {/* Top Left Artistic Flower SVG */}
             <svg viewBox="0 0 200 200" className="absolute top-[6px] left-[6px] w-[140px] h-[140px] stroke-[#cfab68] stroke-[0.8px] fill-transparent transform rotate-6">
                <path d="M120,180 Q100,100 80,40" strokeLinecap="round" />
                <path d="M120,180 Q130,120 160,80" strokeLinecap="round" />
                <path d="M100,150 Q70,160 50,130 Q80,110 100,150 Z" />
                <path d="M110,120 Q140,130 150,100 Q120,90 110,120 Z" />
                <path d="M90,80 C60,90 20,60 50,20 C80,30 100,60 90,80 Z" />
                <path d="M50,20 C30,30 30,60 50,50" />
                <path d="M50,20 C70,30 70,60 50,50" />
                <path d="M150,80 C180,90 190,40 160,20 C130,10 120,70 150,80 Z" />
                <path d="M160,20 C140,30 140,60 160,50" />
                <circle cx="85" cy="165" r="2" fill="#cfab68" />
                <circle cx="100" cy="180" r="2" fill="#cfab68" />
                <circle cx="140" cy="135" r="1.5" fill="#cfab68" />
             </svg>
             
             {/* Bottom Right Artistic Flower SVG */}
             <svg viewBox="0 0 200 200" className="absolute bottom-[6px] right-[6px] w-[150px] h-[150px] stroke-[#cfab68] stroke-[0.8px] fill-transparent transform origin-center rotate-[190deg]">
                <path d="M120,180 Q100,100 80,40" strokeLinecap="round" />
                <path d="M120,180 Q130,120 160,80" strokeLinecap="round" />
                <path d="M100,150 Q70,160 50,130 Q80,110 100,150 Z" />
                <path d="M110,120 Q140,130 150,100 Q120,90 110,120 Z" />
                <path d="M90,80 C60,90 20,60 50,20 C80,30 100,60 90,80 Z" />
                <path d="M50,20 C30,30 30,60 50,50" />
                <path d="M50,20 C70,30 70,60 50,50" />
                <path d="M150,80 C180,90 190,40 160,20 C130,10 120,70 150,80 Z" />
                <path d="M160,20 C140,30 140,60 160,50" />
                <circle cx="85" cy="165" r="2" fill="#cfab68" />
                <circle cx="100" cy="180" r="2" fill="#cfab68" />
                <circle cx="140" cy="135" r="1.5" fill="#cfab68" />
             </svg>
          </div>

          {/* Huge faint background ampersand */}
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none select-none z-0">
             <span className={`${greatVibes.className} text-[400px] text-white/[0.03] transform -translate-y-20`}>&amp;</span>
          </div>

          <div className="relative z-30 flex flex-col items-center flex-1 px-10 pt-28 pb-20">
            <p className={`${manrope.className} text-[10px] uppercase tracking-[0.25em] text-[#cfab68]/80 text-center leading-relaxed mb-10`}>
              Please Join Us For<br/>The Wedding Of
            </p>

            {/* Names */}
            <div className="flex flex-col items-center mb-16 space-y-1">
              <h1 className={`${greatVibes.className} text-6xl text-[#f2d080] filter drop-shadow-lg`}>{wedding.bride_name}</h1>
              <h1 className={`${greatVibes.className} text-6xl text-[#f2d080] filter drop-shadow-lg`}>{wedding.groom_name}</h1>
            </div>

            {/* Function List */}
            <div className="w-full space-y-16 flex flex-col items-center">
              {functions.map((func) => {
                const dateObj = new Date(func.date);
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yyyy = dateObj.getFullYear();
                const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dateObj.getDay()];
                const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

                return (
                  <div key={func.id} className="w-full flex-col flex items-center">
                    {functions.length > 1 && (
                      <p className={`${greatVibes.className} text-3xl text-[#cfab68] mb-5`}>{func.name}</p>
                    )}
                    
                    <p className={`${manrope.className} text-slate-200/90 text-[11px] uppercase tracking-[0.1em] mb-1 font-light text-center`}>{func.venue_name}</p>
                    <p className={`${manrope.className} text-slate-300/60 text-[10px] text-center px-6 leading-relaxed font-light mb-8`}>{func.venue_address}</p>
                    
                    <p className={`${notoSerif.className} italic text-[30px] text-[#f2d080] tracking-widest mb-1 leading-none`}>
                      {dd} <span className="text-[20px] mx-1">.</span> {mm} <span className="text-[20px] mx-1">.</span> {yyyy}
                    </p>
                    <p className={`${manrope.className} text-[#cfab68]/90 text-[12px] font-light text-center tracking-wide leading-tight`}>{dayName},</p>
                    <p className={`${manrope.className} text-[#cfab68]/90 text-[12px] font-light text-center tracking-wide leading-tight`}>{time}</p>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="w-full space-y-4 mt-20 z-30">
              {!hasConfirmedRsvp ? (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
                  className={`${manrope.className} w-full border border-[#cfab68]/30 hover:bg-[#cfab68]/10 text-[#f2d080] font-light tracking-[0.3em] py-4 rounded-sm transition-all uppercase text-[10px]`}
                >
                  {t_i18n("navRSVP")}
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
                  className={`${manrope.className} w-full border border-[#cfab68]/50 hover:bg-[#cfab68]/10 text-[#f2d080] font-light tracking-[0.3em] py-4 rounded-sm transition-all uppercase text-[10px] flex items-center justify-center gap-2`}
                >
                  <span className="material-symbols-outlined text-[14px]">qr_code</span>
                  Show Event Pass
                </button>
              )}
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  // ── ROYAL POSTCARD LAYOUT (Traditional Palace Aesthetic) ────────────────
  if (wedding.template_id === 'royal') {
    return (
      <div className="min-h-screen w-full bg-[#3a0606] flex justify-center">
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] bg-[#6e1616] shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50">
          
          {/* Repeating Mandala/Damask background subtle pattern */}
          <div className="absolute inset-x-4 inset-y-0 opacity-[0.03] pointer-events-none mix-blend-color-burn"
               style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #6e1616 25%, #6e1616 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }} />

          {/* Darker Side panels to simulate the vertical stripe look */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#420a0a] to-transparent pointer-events-none z-0" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#420a0a] to-transparent pointer-events-none z-0" />

          {/* Top Lace Border */}
          <div className="w-full relative z-10 opacity-90 mix-blend-multiply">
            <img
              src="/images/royal_top_lace.png"
              alt=""
              className="w-full h-auto object-cover"
              style={{ maxHeight: '200px', objectPosition: 'top center' }}
            />
          </div>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-20 flex-1">
            
            {/* Palace Motif */}
            <div className="mb-4">
               <img src="/images/royal_center_motif.png" alt="Crest" className="w-[110px] h-auto mix-blend-multiply" />
            </div>

            <p className={`${notoSerif.className} text-[#deb771] text-[9px] font-bold tracking-[0.3em] uppercase mb-4`}>
              {t_i18n("invitedTo")}
            </p>

            <h1 className={`${greatVibes.className} text-6xl text-[#ebc98b] leading-tight text-center`}
                style={{ textShadow: "1px 2px 4px rgba(0,0,0,0.4)" }}>
              {wedding.bride_name}
            </h1>
            <h1 className={`${greatVibes.className} text-4xl text-[#deb771] my-1`}>
              &amp;
            </h1>
            <h1 className={`${greatVibes.className} text-6xl text-[#ebc98b] leading-tight text-center mb-6`}
                style={{ textShadow: "1px 2px 4px rgba(0,0,0,0.4)" }}>
              {wedding.groom_name}
            </h1>

            <p className={`${notoSerif.className} text-[#e8c687] text-[9px] font-bold tracking-[0.4em] uppercase mb-10`}>
              We invite you to celebrate our wedding
            </p>

            {/* Event Details */}
            <div className="w-full space-y-8 mb-10">
              {functions.map((func, i) => (
                <div key={func.id} className="text-center relative">
                  {i > 0 && <div className="absolute -top-5 left-1/3 right-1/3 border-t border-[#deb771]/20" />}
                  <p className={`${notoSerif.className} text-[#ebc98b] text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 drop-shadow-md`}>{func.name}</p>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`${notoSerif.className} text-white/90 text-sm tracking-widest`}>{formatDate(func.date)}</span>
                    <span className={`${notoSerif.className} text-[#deb771]/80 text-[10px]`}>AT {func.time}</span>
                  </div>
                  <p className={`${notoSerif.className} text-white/90 text-[10px] font-medium tracking-[0.1em] uppercase mt-3`}>{func.venue_name}</p>
                </div>
              ))}
            </div>

             {/* Inner Guest Box */}
             <div className="w-[90%] bg-[#420a0a] border border-[#deb771]/40 rounded-sm p-6 flex flex-col items-center text-center shadow-[0_10px_20px_rgba(0,0,0,0.4)] mt-2">
                <p className={`${notoSerif.className} text-white/80 text-[10px] font-bold tracking-widest mb-3`}>
                   Dear {guest.name}
                </p>
                <h2 className={`${notoSerif.className} text-[#ebc98b] text-xl font-bold tracking-wide mb-3 px-4 leading-relaxed`}>
                   {t_i18n("requestPleasure")}
                </h2>
                
                <div className="w-full px-2 mt-4">
                  {hasConfirmedRsvp ? (
                    <button
                      onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
                      className={`w-full h-12 bg-[#210202] border border-[#deb771]/30 text-[#ebc98b] font-bold text-[10px] rounded-sm tracking-[0.25em] uppercase hover:bg-[#330505] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${notoSerif.className}`}
                    >
                      SHOW EVENT PASS
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
                      className={`w-full h-12 bg-[#210202] border border-[#deb771]/30 text-[#ebc98b] font-bold text-[10px] rounded-sm tracking-[0.25em] uppercase hover:bg-[#330505] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${notoSerif.className}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">volunteer_activism</span>
                      {t_i18n("rsvpNow")}
                    </button>
                  )}
                </div>
             </div>
          </div>

          {/* Bottom Lace Border */}
          <div className="w-full relative z-10 opacity-90 mix-blend-multiply mt-auto">
            <img
              src="/images/royal_bottom_lace.png"
              alt=""
              className="w-full h-auto object-cover"
              style={{ maxHeight: '200px', objectPosition: 'bottom center' }}
            />
          </div>

        </div>
      </div>
    );
  }

  // ── FLORAL POSTCARD LAYOUT (Realistic Print Aesthetic) ──────────────────
  if (wedding.template_id === 'floral') {
    return (
      <div className="min-h-screen w-full bg-[#fffdfa] flex justify-center">
        <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-[430px] shadow-2xl bg-[#fffdfa] z-50">
          
          {/* Top Watercolor Art (blends into background) */}
          <div className="absolute top-0 inset-x-0 w-full z-0 opacity-95 pointer-events-none mix-blend-multiply">
            <img
              src="/images/blush_floral_top.png"
              alt=""
              className="w-full h-auto object-cover"
              style={{ maxHeight: '300px', objectPosition: 'top center' }}
            />
          </div>

          {/* Bottom Watercolor Art */}
          <div className="absolute bottom-0 inset-x-0 w-full z-0 opacity-90 pointer-events-none mix-blend-multiply">
            <img
              src="/images/blush_floral_bottom.png"
              alt=""
              className="w-full h-auto object-cover"
              style={{ maxHeight: '350px', objectPosition: 'bottom center' }}
            />
          </div>

          {/* Postcard Content */}
          <div className="relative z-10 flex flex-col items-center pt-40 pb-32">

            {/* Intro Text */}
            <p className={`${notoSerif.className} text-[#5a4848] text-[9px] tracking-[0.35em] uppercase mb-4 font-semibold opacity-80 mt-20`}>
              Together with their families
            </p>

            {/* Bride Name */}
            <h1 className={`${greatVibes.className} text-7xl text-[#4a3a3a] leading-[1.1] text-center pt-2`}
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.03)" }}>
              {wedding.bride_name}
            </h1>

            {/* ------------- FULL WIDTH RIBBON & WAX SEAL ------------- */}
            <div className="relative w-full h-[120px] flex items-center justify-center -my-3 z-20">
              {/* The physical ribbon stretching off-screen (shadows for 3D effect) */}
              <div className="absolute inset-x-[-10px] h-[34px] bg-[#f9e9e6] shadow-[0_2px_4px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,0.7),_inset_0_-2px_4px_rgba(200,160,155,0.15)] flex items-center overflow-hidden">
                 {/* Faint ribbon texture */}
                 <div className="w-full h-full opacity-10 mix-blend-multiply" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #d8bcbc 2px, #d8bcbc 4px)' }} />
              </div>

              {/* The wax seal in the middle */}
              <div className="relative z-30 size-[65px] rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15),_0_8px_20px_rgba(0,0,0,0.05)] bg-[#ebebeb] flex items-center justify-center">
                <img src="/images/pink_wax_seal.png" alt="Wax Seal" className="w-[85px] h-[85px] max-w-none mix-blend-multiply scale-110 drop-shadow-md rounded-full pointer-events-none" />
                {/* Initials pressed inside the seal (if image is blank) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-80 pointer-events-none">
                  <span className={`${notoSerif.className} text-[#b87d7b] font-bold text-xl mix-blend-color-burn`}>
                    {wedding.bride_name.charAt(0)}&amp;{wedding.groom_name.charAt(0)}
                  </span>
                </div>
              </div>
            </div>
            {/* ----------------------------------------------------- */}

            {/* Groom Name */}
            <h1 className={`${greatVibes.className} text-7xl text-[#4a3a3a] leading-[1] text-center mb-8 pb-2`}
                style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.03)" }}>
              {wedding.groom_name}
            </h1>

            <p className={`${notoSerif.className} text-[#5a4848]/80 text-[11px] italic text-center mb-10 tracking-widest leading-relaxed`}>
              request the pleasure of your company<br/>to celebrate their marriage
            </p>

            {/* Event details container with slight white backing for legibility */}
            <div className="w-full max-w-[340px] space-y-10 mb-12 bg-white/40 backdrop-blur-[2px] p-6 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.6)]">
              {functions.map((func, i) => (
                <div key={func.id} className="text-center relative">
                  {i > 0 && <div className="absolute -top-5 left-1/4 right-1/4 border-t border-dashed border-[#5a4848]/20" />}
                  <p className={`${notoSerif.className} text-[#7a6464] text-[10px] tracking-[0.25em] uppercase font-bold mb-2`}>{func.name}</p>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`${notoSerif.className} text-[#3a2e2e] text-lg font-medium tracking-wide`}>{formatDate(func.date)}</span>
                    <span className={`${notoSerif.className} text-[#5a4848] text-xs`}>AT {func.time}</span>
                  </div>
                  <p className={`${notoSerif.className} text-[#3a2e2e] text-[11px] font-bold tracking-[0.1em] uppercase mt-4`}>{func.venue_name}</p>
                  
                  {func.maps_url && (
                    <a href={func.maps_url} target="_blank" rel="noopener"
                      className="text-[#987a7a] text-[9px] tracking-[0.2em] font-bold uppercase underline hover:opacity-100 opacity-80 mt-2 inline-block">
                      {t_i18n("viewOnMaps")}
                    </a>
                  )}
                </div>
              ))}
            </div>

            <p className={`${greatVibes.className} text-4xl text-[#7a6464] mb-8`}>
               Dear {guest.name},
            </p>

            {/* RSVP Button */}
            <div className="w-full max-w-[280px] z-20">
               {hasConfirmedRsvp ? (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/confirmed`)}
                  className={`w-full h-12 bg-[#8c6767] border border-[#7a5656] text-white font-medium text-[10px] rounded-sm tracking-[0.25em] uppercase shadow-lg shadow-[#8c6767]/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${notoSerif.className}`}
                >
                  SHOW EVENT PASS
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/${locale}/invite/${token}/rsvp`)}
                   className={`w-full h-12 bg-[#8c6767] border border-[#7a5656] text-white font-medium text-[10px] rounded-sm tracking-[0.25em] uppercase shadow-lg shadow-[#8c6767]/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${notoSerif.className}`}
                >
                  {t_i18n("rsvpNow")}
                </button>
              )}
            </div>

            {/* Language Switcher */}
            <div className="mt-8 flex gap-5 z-20">
              {['en', 'hi'].map((l) => (
                <button key={l}
                  onClick={() => router.push(`/${l}/invite/${token}`)}
                  className={`text-[9px] font-bold uppercase tracking-widest pb-1 transition-all ${
                    locale === l ? 'border-b border-[#5a4848] text-[#5a4848]' : 'text-[#5a4848]/50 hover:text-[#5a4848]'
                  }`}
                >
                  {l === 'en' ? 'English' : 'हिन्दी'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div className={`w-full border rounded-2xl p-6 text-center mb-10 transition-all bg-black/[0.02] border-black/5`}>
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
