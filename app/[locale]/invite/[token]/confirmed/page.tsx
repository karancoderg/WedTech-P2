"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction, RSVP } from "@/lib/types";
import { generateGoogleCalendarLink } from "@/lib/whatsapp";
import { Great_Vibes } from "next/font/google";

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });

export default function ConfirmedPage() {
  const params = useParams();
  const token = params.token as string;

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    // Generate QR Code
    QRCode.toDataURL(token, {
      width: 250,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrCodeDataUrl)
      .catch(console.error);

    async function fetchData() {
      const { data: tokenData } = await supabase.from("invite_tokens").select("*").eq("token", token).single();
      if (!tokenData) { setLoading(false); return; }

      const [weddingRes, guestRes, funcRes, rsvpRes] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", tokenData.wedding_id).single(),
        supabase.from("guests").select("*").eq("id", tokenData.guest_id).single(),
        supabase.from("wedding_functions").select("*").eq("wedding_id", tokenData.wedding_id).order("sort_order"),
        supabase.from("rsvps").select("*").eq("invite_token", token),
      ]);
      if (weddingRes.data) setWedding(weddingRes.data);
      if (guestRes.data) setGuest(guestRes.data);
      if (funcRes.data) setFunctions(funcRes.data);
      if (rsvpRes.data) setRsvps(rsvpRes.data);
      setLoading(false);
    }
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!wedding || !guest) return null;

  const confirmedFunctionIds = Array.from(new Set(
    rsvps.filter((r) => r.status === "confirmed").map((r) => r.function_id)
  ));
  const confirmedFunctions = confirmedFunctionIds
    .map((id) => functions.find((f) => f.id === id))
    .filter(Boolean) as WeddingFunction[];

  const paxByGuest = new Map<string, number>();
  rsvps.filter((r) => r.status === "confirmed").forEach((r) => {
    const current = paxByGuest.get(r.guest_id) || 0;
    if (r.total_pax > current) paxByGuest.set(r.guest_id, r.total_pax);
  });
  const totalPax = Array.from(paxByGuest.values()).reduce((s, v) => s + v, 0);

  const dietaryPreferences = Array.from(new Set(
    rsvps.map((r) => r.dietary_preference).filter(Boolean)
  ));
  const dietary = dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : null;
  const needsAcc = rsvps.some((r) => r.needs_accommodation && r.status === "confirmed");

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${token}`;
  const waShareLink = `https://wa.me/?text=${encodeURIComponent(
    `Check out the invitation for ${wedding.bride_name} & ${wedding.groom_name}'s wedding! ${shareUrl}`
  )}`;

  const themeStyles = {
    floral: {
      bg: "bg-transparent",
      textAccent: "text-emerald-700",
      textPrimary: "text-slate-800",
      textSecondary: "text-slate-500",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      cardBg: "bg-white/70 backdrop-blur-sm border-emerald-100",
      cardSubBg: "bg-emerald-50/50",
      borderTop: "border-emerald-100",
      buttonLink: "text-emerald-700 hover:text-emerald-800",
      whatsappBtn: "border-green-500 text-green-700 bg-green-50/50 hover:bg-green-100",
    },
    royal: {
      bg: "bg-slate-950",
      textAccent: "text-amber-400",
      textPrimary: "text-white",
      textSecondary: "text-amber-200/80",
      iconBg: "bg-amber-500/20",
      iconText: "text-amber-400",
      cardBg: "bg-slate-900 border-amber-500/20",
      cardSubBg: "bg-slate-800/50",
      borderTop: "border-amber-500/20",
      buttonLink: "text-amber-400 hover:text-amber-300",
      whatsappBtn: "border-green-600 text-green-400 bg-green-500/10 hover:bg-green-500/20",
    },
    minimal: {
      bg: "bg-white",
      textAccent: "text-slate-900",
      textPrimary: "text-slate-900",
      textSecondary: "text-slate-500",
      iconBg: "bg-slate-100",
      iconText: "text-slate-900",
      cardBg: "bg-white border-slate-200",
      cardSubBg: "bg-slate-50",
      borderTop: "border-slate-100",
      buttonLink: "text-slate-900 hover:text-slate-700",
      whatsappBtn: "border-slate-300 text-slate-800 bg-slate-50 hover:bg-slate-100",
    },
    dark: {
      bg: "bg-[#0b141f]",
      textAccent: "text-[#f2ca50]",
      textPrimary: "text-[#dae3f3]",
      textSecondary: "text-[#7f735a]",
      iconBg: "bg-[#f2ca50]/20",
      iconText: "text-[#f2ca50]",
      cardBg: "bg-[#18202c] border-[#f2ca50]/20",
      cardSubBg: "bg-[#0b141f]/50",
      borderTop: "border-[#f2ca50]/20",
      buttonLink: "text-[#f2ca50] hover:text-[#cfab68]",
      whatsappBtn: "border-green-500 text-[#dae3f3] bg-[#0b141f] hover:bg-[#18202c]",
    },
    bohemian: {
      bg: "bg-[#f4f4f4]",
      textAccent: "text-[#18362b]",
      textPrimary: "text-[#1c1c19]",
      textSecondary: "text-[#54433e]/70",
      iconBg: "bg-[#18362b]/10",
      iconText: "text-[#18362b]",
      cardBg: "bg-white border-[#18362b]/20",
      cardSubBg: "bg-[#f4f4f4]",
      borderTop: "border-[#18362b]/20",
      buttonLink: "text-[#18362b] hover:text-[#122820]",
      whatsappBtn: "border-green-600 text-green-700 bg-green-50/50 hover:bg-green-100",
    }
  };

  const t = themeStyles[wedding.template_id as keyof typeof themeStyles] || themeStyles['floral'];

  const outerBg = wedding.template_id === 'floral' ? 'bg-[#fffdfa]' : (wedding.template_id === 'royal' ? 'bg-[#faf5f5]' : wedding.template_id === 'minimal' ? 'bg-[#f6f4fa]' : wedding.template_id === 'dark' ? 'bg-[#e8e9ea]' : wedding.template_id === 'bohemian' ? 'bg-[#f4f4f4]' : 'bg-[#FAFAF9]');
  const innerBg = wedding.template_id === 'floral' ? 'bg-[#fffdfa]' : (wedding.template_id === 'royal' ? 'bg-[#6e1616] shadow-[0_0_50px_rgba(0,0,0,0.8)]' : wedding.template_id === 'minimal' ? 'bg-[#ffffff]' : wedding.template_id === 'dark' ? 'bg-[#051c2c] shadow-[0_0_40px_rgba(0,0,0,0.4)]' : wedding.template_id === 'bohemian' ? 'bg-white' : t.bg);

  return (
    <div className={`min-h-screen w-full flex justify-center relative overflow-hidden ${outerBg}`}>
      {/* Extra Laptop Corners Background (Hidden on Mobile) */}
      {/* Extra Laptop Background (Removed) */}

      <div className={`relative w-full max-w-[430px] min-h-screen ${innerBg} shadow-2xl flex flex-col overflow-x-hidden transition-colors duration-500 z-10`}>
        {/* Dynamic Backgrounds based on Theme */}
        <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
          <div className="w-full max-w-[430px] relative h-full">
            {wedding.template_id === 'floral' ? (
              <>
                <div className="absolute inset-0 bg-[#fffdfa]" />
                <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-95 mix-blend-multiply object-cover" style={{ maxHeight: '300px', objectPosition: 'top center' }} />
                <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ maxHeight: '350px', objectPosition: 'bottom center' }} />
              </>
            ) : wedding.template_id === 'royal' ? (
              <>
                <div className="absolute inset-0 bg-[#6e1616]" />
                <div className="absolute inset-x-4 inset-y-0 opacity-[0.03] mix-blend-color-burn" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }} />
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#420a0a] to-transparent z-0" />
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#420a0a] to-transparent z-0" />
                <img src="/images/royal_top_lace.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-90 mix-blend-multiply h-auto object-cover" style={{ maxHeight: '200px', objectPosition: 'top center' }} />
                <img src="/images/royal_bottom_lace.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply h-auto object-cover" style={{ maxHeight: '200px', objectPosition: 'bottom center' }} />
              </>
            ) : wedding.template_id === 'minimal' ? (
              <>
                <div className="absolute inset-0 bg-[#f8f0f2]" />
                <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-top" />
                <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-bottom" />
              </>
            ) : wedding.template_id === 'dark' ? (
              <>
                {/* Inner Thin Gold Rectangular Broken Border */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-[12px] left-[98px] right-[12px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
                  <div className="absolute top-[12px] bottom-[98px] right-[12px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
                  <div className="absolute bottom-[12px] left-[12px] right-[98px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
                  <div className="absolute top-[98px] bottom-[12px] left-[12px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
                </div>
                
                {/* Intricate Hand-drawn Gold Vector Line Art Florals */}
                <div className="absolute top-0 left-0 z-20 pointer-events-none opacity-80 select-none overflow-hidden w-full h-full">
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
               </>
             ) : wedding.template_id === 'bohemian' ? (
               <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                 <path d="M0,0 L85,0 C65,15 70,30 95,45 L100,45 L100,85 C75,90 60,75 30,80 C10,85 0,90 0,90 Z" fill="#e3ab9f" opacity="0.9" />
                 <polyline points="0,5 30,30 15,50" fill="none" stroke="white" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="0,12 35,38 20,55" fill="none" stroke="white" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="0,19 40,46 25,60" fill="none" stroke="white" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="60,100 80,75 100,85" fill="none" stroke="#e3ab9f" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="50,100 75,70 100,80" fill="none" stroke="#e3ab9f" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="40,100 70,65 100,75" fill="none" stroke="#e3ab9f" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <polyline points="30,100 65,60 100,70" fill="none" stroke="#e3ab9f" strokeWidth="0.4" strokeLinejoin="miter"/>
                 <path d="M25,100 C30,85 55,85 65,100 Z" fill="#1b3a30" />
                 <path d="M0,85 C15,85 20,100 0,100 Z" fill="#1b3a30" />
                 <path d="M0,75 C25,85 40,75 70,85 C85,90 100,85 100,85 L100,100 L0,100 Z" fill="white" opacity="0.8" />
                 <path d="M10,100 C15,90 45,90 55,100 Z" fill="#1b3a30" />
                 <path d="M75,100 C80,95 95,95 100,100 Z" fill="#1b3a30" />
               </svg>
             ) : (
              <img src="/images/watercolor_bg.png" alt="background" className="w-full h-full object-cover opacity-40" />
            )}
          </div>
        </div>

      {/* Header */}
      <div className={`relative z-10 flex items-center bg-transparent p-4 pb-2 justify-between ${(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'pt-[200px]' : wedding.template_id === 'bohemian' ? 'pt-[160px]' : ''}`}>
        <div className="size-12" />
        <h2 className={`${t.textPrimary} text-lg font-semibold leading-tight tracking-tight flex-1 text-center`}>
          RSVP Confirmation
        </h2>
        <div className="size-12" />
      </div>

      {/* Celebration Hero */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-10 pb-8 text-center">
        <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${t.iconBg} animate-scale-in`}>
          <span className={`material-symbols-outlined ${t.iconText} text-[48px] font-bold`}>check_circle</span>
        </div>
        <h1 className={`${t.textPrimary} text-3xl font-bold leading-tight mb-2`}>
          You&apos;re all set! 🎉
        </h1>
        <p className={`${t.textAccent} ${greatVibes.className} text-3xl font-medium mt-2`}>
          {wedding.bride_name} &amp; {wedding.groom_name} 
          <span className="block text-base font-sans text-slate-500 mt-2">can&apos;t wait to see you!</span>
        </p>
      </div>

      {/* QR Code Pass */}
      {qrCodeDataUrl && (
        <div className="relative z-10 px-4 pb-6">
          <div className={`${t.cardBg} flex flex-col items-center rounded-2xl shadow-sm border p-6`}>
            <p className={`text-xs font-bold ${t.textSecondary} uppercase tracking-widest mb-4`}>Your Event Pass</p>
            <div className={`p-2 border-2 ${t.borderTop} rounded-2xl bg-white shadow-sm`}>
              <img src={qrCodeDataUrl} alt="Check-in QR Code" className="w-[150px] h-[150px] rounded-xl" />
            </div>
            <p className={`text-xs ${t.textSecondary} mt-4 text-center max-w-[200px] opacity-80`}>
              Please show this QR code at the venue for quick check-in
            </p>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="relative z-10 px-4 pb-6">
        <div className={`${t.cardBg} rounded-2xl shadow-sm border p-6`}>
          <h3 className={`${t.textPrimary} text-lg font-bold mb-4`}>RSVP Summary</h3>

          {/* Event Status List */}
          <div className="space-y-3 mb-6">
            {functions.filter(f => rsvps.some(r => r.function_id === f.id)).map((func) => {
              const funcRsvps = rsvps.filter(r => r.function_id === func.id);
              const isConfirmed = funcRsvps.some(r => r.status === "confirmed");
              const isDeclined = funcRsvps.every(r => r.status === "declined");
              
              if (!isConfirmed && !isDeclined) return null;
              
              const status = isConfirmed ? "confirmed" : "declined";
              const confirmingCount = funcRsvps.filter(r => r.status === "confirmed").reduce((sum, r) => sum + r.total_pax, 0);

              return (
                <div key={func.id} className={`flex items-center justify-between p-3 rounded-lg ${t.cardSubBg} ${status === "declined" ? "opacity-60" : ""}`}>
                  <span className={`font-medium ${t.textPrimary}`}>{func.name}</span>
                  <div className={`flex items-center gap-1 font-semibold ${status === "confirmed" ? t.iconText : t.textSecondary}`}>
                    <span className="material-symbols-outlined text-sm">
                      {status === "confirmed" ? "check_circle" : "cancel"}
                    </span>
                    <span>{status === "confirmed" ? `Yes (${confirmingCount})` : "No"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Guest Details */}
          <div className={`grid grid-cols-1 gap-4 border-t ${t.borderTop} pt-6`}>
            {totalPax > 0 && (
              <div className="flex items-center justify-between">
                <span className={`${t.textSecondary} text-sm`}>Party size</span>
                <span className={`font-semibold ${t.textPrimary}`}>{totalPax} {totalPax === 1 ? "Guest" : "Guests"}</span>
              </div>
            )}
            {dietary && (
              <div className="flex items-center justify-between">
                <span className={`${t.textSecondary} text-sm`}>Dietary preference</span>
                <span className={`font-semibold ${t.textPrimary} capitalize`}>{dietary}</span>
              </div>
            )}
            {needsAcc && (
              <div className="flex items-center justify-between">
                <span className={`${t.textSecondary} text-sm`}>Accommodation</span>
                <span className={`font-semibold ${t.textAccent}`}>Needed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Actions */}
      <div className="relative z-10 px-4 space-y-4 mb-8">
        {confirmedFunctions.map((func) => (
          <a
            key={func.id}
            href={generateGoogleCalendarLink(func, wedding)}
            target="_blank"
            rel="noopener"
            className={`flex items-center gap-3 ${t.buttonLink} font-semibold text-sm px-4`}
          >
            <span className="material-symbols-outlined">calendar_add_on</span>
            Add {func.name} to Google Calendar
          </a>
        ))}
      </div>

      {/* WhatsApp Share */}
      <div className="relative z-10 px-4 mb-10">
        <a href={waShareLink} target="_blank" rel="noopener">
          <button className={`w-full flex items-center justify-center gap-3 py-4 border-2 font-bold rounded-xl transition-colors ${t.whatsappBtn}`}>
            <span className="material-symbols-outlined">share</span>
            Share with family on WhatsApp
          </button>
        </a>
      </div>

      {/* Footer */}
      <footer className={`relative z-10 mt-auto pt-8 pb-${(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? '[380px]' : '8'} text-center px-6`}>
        <p className={`italic ${t.textSecondary} text-sm mb-4`}>&ldquo;Together is a beautiful place to be&rdquo;</p>
        <div className="flex flex-col items-center gap-1">
          <p className={`text-[10px] uppercase tracking-widest ${t.textSecondary} font-bold opacity-60`}>Powered by WedSync</p>
          <div className={`h-1 w-8 ${t.textAccent} bg-current opacity-20 rounded-full mt-2`} />
        </div>
      </footer>
    </div>
    </div>
  );
}
