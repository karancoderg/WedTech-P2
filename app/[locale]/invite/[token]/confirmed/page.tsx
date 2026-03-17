"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction, RSVP } from "@/lib/types";
import { generateGoogleCalendarLink } from "@/lib/whatsapp";

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
      bg: "bg-[#fdfbf7]",
      textAccent: "text-rose-700",
      textPrimary: "text-rose-950",
      textSecondary: "text-rose-700/80",
      iconBg: "bg-rose-100",
      iconText: "text-rose-600",
      cardBg: "bg-white border-rose-100",
      cardSubBg: "bg-rose-50/50",
      borderTop: "border-rose-100",
      buttonLink: "text-rose-700 hover:text-rose-800",
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
    }
  };

  const t = themeStyles[wedding.template_id || 'floral'];

  return (
    <div className={`relative w-full max-w-[430px] min-h-screen ${t.bg} shadow-2xl flex flex-col overflow-x-hidden mx-auto transition-colors duration-500`}>
      {/* Header */}
      <div className="flex items-center bg-transparent p-4 pb-2 justify-between">
        <div className="size-12" />
        <h2 className={`${t.textPrimary} text-lg font-semibold leading-tight tracking-tight flex-1 text-center`}>
          RSVP Confirmation
        </h2>
        <div className="size-12" />
      </div>

      {/* Celebration Hero */}
      <div className="flex flex-col items-center px-6 pt-10 pb-8 text-center">
        <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${t.iconBg} animate-scale-in`}>
          <span className={`material-symbols-outlined ${t.iconText} text-[48px] font-bold`}>check_circle</span>
        </div>
        <h1 className={`${t.textPrimary} text-3xl font-bold leading-tight mb-2`}>
          You&apos;re all set! 🎉
        </h1>
        <p className={`${t.textSecondary} text-base font-medium`}>
          {wedding.bride_name} &amp; {wedding.groom_name} can&apos;t wait to see you!
        </p>
      </div>

      {/* QR Code Pass */}
      {qrCodeDataUrl && (
        <div className="px-4 pb-6">
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
      <div className="px-4 pb-6">
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
      <div className="px-4 space-y-4 mb-8">
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
      <div className="px-4 mb-10">
        <a href={waShareLink} target="_blank" rel="noopener">
          <button className={`w-full flex items-center justify-center gap-3 py-4 border-2 font-bold rounded-xl transition-colors ${t.whatsappBtn}`}>
            <span className="material-symbols-outlined">share</span>
            Share with family on WhatsApp
          </button>
        </a>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center px-6">
        <p className={`italic ${t.textSecondary} text-sm mb-4`}>&ldquo;Together is a beautiful place to be&rdquo;</p>
        <div className="flex flex-col items-center gap-1">
          <p className={`text-[10px] uppercase tracking-widest ${t.textSecondary} font-bold opacity-60`}>Powered by WedSync</p>
          <div className={`h-1 w-8 ${t.textAccent} bg-current opacity-20 rounded-full mt-2`} />
        </div>
      </footer>
    </div>
  );
}
