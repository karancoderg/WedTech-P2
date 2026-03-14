"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { syncGuestWithCRM } from "@/lib/services/crm-sync";
import QRCode from "qrcode";

interface FunctionResponse {
  functionId: string;
  functionName: string;
  status: "confirmed" | "declined" | "";
  plusOnes: number;
  children: number;
  dietaryPreference: "veg" | "jain" | "non-veg" | null;
  needsAccommodation: boolean;
}

export default function RSVPFormPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const t_i18n = useTranslations("RSVP");

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  // Store responses per guest: { [guestId]: FunctionResponse[] }
  const [responses, setResponses] = useState<Record<string, FunctionResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      const { data: tokenData } = await supabase.from("invite_tokens").select("*").eq("token", token).single();
      if (!tokenData) { setLoading(false); return; }

      const [weddingRes, guestRes, funcRes] = await Promise.all([
        supabase.from("weddings").select("*").eq("id", tokenData.wedding_id).single(),
        supabase.from("guests").select("*").eq("id", tokenData.guest_id).single(),
        supabase.from("wedding_functions").select("*").eq("wedding_id", tokenData.wedding_id).in("id", tokenData.function_ids).order("sort_order"),
      ]);
 
      if (weddingRes.data) setWedding(weddingRes.data);
      if (funcRes.data) setFunctions(funcRes.data);
      
      let allGuests: Guest[] = [];
      if (guestRes.data) {
        const primaryGuest = guestRes.data;
        if (primaryGuest.group_id) {
          const { data: groupGuests } = await supabase
            .from("guests")
            .select("*")
            .eq("group_id", primaryGuest.group_id);
          allGuests = groupGuests || [primaryGuest];
        } else {
          allGuests = [primaryGuest];
        }
        setGuests(allGuests);
      }

      const initialResponses: Record<string, FunctionResponse[]> = {};
      allGuests.forEach((g) => {
        initialResponses[g.id] = (funcRes.data || []).map((f) => ({
          functionId: f.id,
          functionName: f.name,
          status: "",
          plusOnes: 0,
          children: 0,
          dietaryPreference: null,
          needsAccommodation: false,
        }));
      });
      setResponses(initialResponses);
      
      if (tokenData.used) {
        setShowCompleted(true);
      }
      setLoading(false);
    }
    fetchData();
  }, [token]);
  
  useEffect(() => {
    if (showCompleted && guests.length > 0) {
      // Primary guest's token is used for QR
      QRCode.toDataURL(token)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error("QR Code Error:", err));
    }
  }, [showCompleted, guests, token]);

  function updateResponse(guestId: string, index: number, updates: Partial<FunctionResponse>) {
    setResponses(prev => {
      const guestResponses = [...prev[guestId]];
      guestResponses[index] = { ...guestResponses[index], ...updates };
      return { ...prev, [guestId]: guestResponses };
    });
  }

  async function handleSubmit() {
    const allAnswered = Object.values(responses).every(resps => resps.every(r => r.status));
    if (!allAnswered) { toast.error(t_i18n("respondAll")); return; }
    
    setSubmitting(true);
    try {
      for (const guestId of Object.keys(responses)) {
        const guestResponses = responses[guestId];
        for (const resp of guestResponses) {
          const totalPax = resp.status === "confirmed" ? 1 + resp.plusOnes + resp.children : 0;
          await supabase.from("rsvps").upsert({
            wedding_id: wedding!.id, 
            guest_id: guestId, 
            function_id: resp.functionId,
            invite_token: token, 
            status: resp.status, 
            plus_ones: resp.plusOnes,
            children: resp.children, 
            total_pax: totalPax, 
            dietary_preference: resp.dietaryPreference,
            needs_accommodation: resp.needsAccommodation, 
            responded_at: new Date().toISOString(),
          }, { onConflict: "guest_id,function_id" });
        }
        
        const allConfirmed = guestResponses.every((r) => r.status === "confirmed");
        const allDeclined = guestResponses.every((r) => r.status === "declined");
        await supabase.from("guests")
          .update({ overall_status: allConfirmed ? "confirmed" : allDeclined ? "declined" : "partial" })
          .eq("id", guestId);

        // Sync with CRM (Product 1)
        if (allConfirmed || !allDeclined) {
          syncGuestWithCRM(guestId);
        }
      }
      
      await supabase.from("invite_tokens").update({ used: true }).eq("token", token);
      router.push(`/invite/${token}/confirmed`);
    } catch (error) {
      console.error(error);
      toast.error(t_i18n("error"));
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!wedding || guests.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <p className="text-slate-500">Invalid invitation link</p>
      </div>
    );
  }

  const themeStyles = {
    floral: {
      bg: "bg-[#fdfbf7]",
      borderTop: "border-rose-200",
      textAccent: "text-rose-700",
      textPrimary: "text-rose-950",
      textSecondary: "text-rose-700/80",
      fontHeading: "font-serif",
      button: "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-200",
      cardBg: "bg-rose-50/50 border-rose-100",
      icon: "text-rose-600",
      iconBg: "bg-rose-600",
      checkbox: "peer-checked:bg-rose-700",
      cardActive: "border-rose-700",
      cardInactive: "border-transparent hover:border-rose-700/20",
      bgSub: "bg-white",
    },
    royal: {
      bg: "bg-slate-950",
      borderTop: "border-amber-500/30",
      textAccent: "text-amber-400",
      textPrimary: "text-white",
      textSecondary: "text-amber-200/80",
      fontHeading: "font-serif",
      button: "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20",
      cardBg: "bg-slate-900 border-amber-500/20",
      icon: "text-amber-500",
      iconBg: "bg-amber-500",
      checkbox: "peer-checked:bg-amber-500",
      cardActive: "border-amber-500",
      cardInactive: "border-transparent hover:border-amber-500/20",
      bgSub: "bg-slate-900",
    },
    minimal: {
      bg: "bg-white",
      borderTop: "border-slate-200",
      textAccent: "text-slate-900",
      textPrimary: "text-slate-900",
      textSecondary: "text-slate-500",
      fontHeading: "font-sans font-black tracking-tight",
      button: "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200",
      cardBg: "bg-slate-50 border-slate-100",
      icon: "text-slate-900",
      iconBg: "bg-slate-900",
      checkbox: "peer-checked:bg-slate-900",
      cardActive: "border-slate-900",
      cardInactive: "border-transparent hover:border-slate-900/20",
      bgSub: "bg-white",
    }
  };

  const t = themeStyles[wedding.template_id || 'floral'];

  if (showCompleted) {
    return (
      <div className={`relative flex min-h-screen w-full flex-col max-w-md mx-auto transition-colors duration-500 ${t.bg}`}>
        <header className={`sticky top-0 z-50 flex items-center ${t.bgSub} backdrop-blur-md px-4 py-4 justify-between border-b ${t.borderTop}`}>
          <div className={`${t.textPrimary} flex size-10 shrink-0 items-center justify-center`}>
            {/* Logo or placeholder */}
          </div>
          <h2 className={`${t.fontHeading} ${t.textAccent} text-xl font-bold leading-tight flex-1 text-center`}>
            {wedding.bride_name} &amp; {wedding.groom_name}
          </h2>
          <div className="size-10 shrink-0" />
        </header>

        <main className="flex-1 px-6 pt-12 pb-24 text-center">
          <div className={`${t.cardBg} border rounded-[2rem] p-8 shadow-xl relative overflow-hidden`}>
            {/* Background pattern/accent */}
            <div className={`absolute top-0 left-0 w-full h-2 ${t.iconBg} opacity-20`} />
            
            <span className="material-symbols-outlined text-green-600 text-6xl mb-6">verified</span>
            <h1 className={`${t.fontHeading} ${t.textPrimary} text-3xl font-black mb-4`}>
              {t_i18n("thankYou")}
            </h1>
            <p className={`${t.textSecondary} mb-8`}>
              {t_i18n("rsvpCompleted")}
            </p>

            <div className="bg-white p-6 rounded-3xl inline-block shadow-inner mb-6 border-4 border-slate-50">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Pass" className="size-48" />
              ) : (
                <div className="size-48 bg-slate-100 animate-pulse rounded-2xl" />
              )}
            </div>

            <div className="space-y-4">
              <p className={`text-sm font-bold uppercase tracking-widest ${t.textAccent}`}>
                {guests.length > 1 ? "Family Check-In Pass" : "Personal Check-In Pass"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {guests.map(g => (
                  <div key={g.id} className={`${t.textPrimary} font-bold px-3 py-1 rounded-full bg-white/50 text-sm border ${t.borderTop}`}>
                    {g.name}
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-10 pt-8 border-t ${t.borderTop} flex flex-col items-center gap-2`}>
              <p className="text-xs text-slate-400 font-medium">SCAN THIS AT THE ENTRANCE</p>
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-slate-400">confirmation_number</span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">Token: {token.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(`/invite/${token}`)}
            className={`mt-12 w-full py-4 rounded-xl border-2 ${t.borderTop} ${t.textPrimary} font-bold flex items-center justify-center gap-2 hover:bg-white/50 transition-all`}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Invitation
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-screen w-full flex-col max-w-md mx-auto transition-colors duration-500 ${t.bg}`}>
      {/* Sticky Header */}
      <header className={`sticky top-0 z-50 flex items-center ${t.bgSub} backdrop-blur-md px-4 py-4 justify-between border-b ${t.borderTop}`}>
        <div className={`${t.textPrimary} flex size-10 shrink-0 items-center justify-center cursor-pointer`} onClick={() => router.back()}>
          <span className="material-symbols-outlined">close</span>
        </div>
        <h2 className={`${t.fontHeading} ${t.textAccent} text-xl font-bold leading-tight flex-1 text-center`}>
          {wedding.bride_name} &amp; {wedding.groom_name}
        </h2>
        <div className="size-10 shrink-0" />
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        {guests.map((g, gIdx) => (
          <div key={g.id} className={gIdx > 0 ? `border-t-4 ${t.borderTop} mt-12 pt-8` : ""}>
            {/* Guest Name Header */}
            {guests.length > 1 && (
              <div className="px-6 mb-4">
                <div className={`${t.cardBg} border rounded-2xl p-4 flex items-center justify-center gap-3 shadow-sm`}>
                  <span className={`material-symbols-outlined ${t.icon}`}>person</span>
                  <span className={`${t.textPrimary} text-xl font-black`}>{g.name}</span>
                </div>
              </div>
            )}

            {responses[g.id]?.map((resp, index) => (
              <div key={resp.functionId}>
                {/* Hero Question */}
                <section className="px-6 pt-4 pb-4 text-center">
                  <h3 className={`${t.textPrimary} text-2xl font-bold leading-tight mb-2`}>
                    {t_i18n("willYouAttend", { function: resp.functionName })}
                  </h3>
                  <p className={`${t.textSecondary} text-sm`}>{t_i18n("joinUs")}</p>
                </section>

                {/* Attendance Selection */}
                <div className="px-6 space-y-3 mb-8">
                  <label
                    className={`relative flex items-center p-4 rounded-xl border-2 ${t.bgSub} shadow-sm cursor-pointer transition-all ${
                      resp.status === "confirmed" ? t.cardActive : t.cardInactive
                    }`}
                    onClick={() => updateResponse(g.id, index, { status: "confirmed" })}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full text-green-600">
                          <span className="material-symbols-outlined">check_circle</span>
                        </div>
                        <span className={`font-semibold text-lg ${resp.status === "confirmed" ? t.textPrimary : t.textSecondary}`}>
                          {t_i18n("yes")}
                        </span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        resp.status === "confirmed" ? t.cardActive : t.borderTop
                      }`}>
                        {resp.status === "confirmed" && <div className={`w-3 h-3 ${t.iconBg} rounded-full`} />}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`relative flex items-center p-4 rounded-xl border-2 ${t.bgSub} shadow-sm cursor-pointer transition-all ${
                      resp.status === "declined" ? "border-red-400" : t.cardInactive
                    }`}
                    onClick={() => updateResponse(g.id, index, { status: "declined", plusOnes: 0, children: 0, dietaryPreference: null, needsAccommodation: false })}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full text-red-600">
                          <span className="material-symbols-outlined">cancel</span>
                        </div>
                        <span className={`font-semibold text-lg ${resp.status === "declined" ? t.textPrimary : t.textSecondary}`}>
                          {t_i18n("no")}
                        </span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 ${resp.status === "declined" ? "border-red-400" : "border-slate-200"}`}>
                        {resp.status === "declined" && <div className="w-3 h-3 bg-red-400 rounded-full" />}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Conditional Detail Form */}
                {resp.status === "confirmed" && (
                  <div className="px-6 space-y-6 animate-in fade-in">
                    <div className={`${t.bgSub} rounded-xl p-5 shadow-sm space-y-6 border ${t.borderTop}`}>
                      {/* Plus-Ones */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`font-bold ${t.textPrimary}`}>{t_i18n("adultsOnly")}</h4>
                          <span className={`text-xs ${t.textAccent} font-medium uppercase tracking-wider`}>{t_i18n("adultsOnly")}</span>
                        </div>
                        <div className={`flex items-center justify-between ${t.cardBg} p-3 rounded-lg border`}>
                          <p className={`${t.textSecondary} text-sm`}>{t_i18n("numberOfGuests")}</p>
                          <div className="flex items-center gap-4">
                            <button onClick={() => updateResponse(g.id, index, { plusOnes: Math.max(0, resp.plusOnes - 1) })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>−</button>
                            <span className={`font-bold ${t.textPrimary} w-4 text-center`}>{resp.plusOnes}</span>
                            <button onClick={() => updateResponse(g.id, index, { plusOnes: resp.plusOnes + 1 })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>+</button>
                          </div>
                        </div>
                      </div>

                      {/* Children */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`font-bold ${t.textPrimary}`}>{t_i18n("below12")}</h4>
                          <span className={`text-xs ${t.textAccent} font-medium uppercase tracking-wider`}>{t_i18n("below12")}</span>
                        </div>
                        <div className={`flex items-center justify-between ${t.cardBg} p-3 rounded-lg border`}>
                          <p className={`${t.textSecondary} text-sm`}>{t_i18n("numberOfKids")}</p>
                          <div className="flex items-center gap-4">
                            <button onClick={() => updateResponse(g.id, index, { children: Math.max(0, resp.children - 1) })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>−</button>
                            <span className={`font-bold ${t.textPrimary} w-4 text-center`}>{resp.children}</span>
                            <button onClick={() => updateResponse(g.id, index, { children: resp.children + 1 })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>+</button>
                          </div>
                        </div>
                      </div>

                      <hr className={t.borderTop} />

                      {/* Dietary Preference */}
                      <div>
                        <h4 className={`font-bold ${t.textPrimary} mb-4`}>{t_i18n("dietaryPreference")}</h4>
                        <div className="flex gap-2">
                          {[
                            { value: "veg" as const, label: "Veg", emoji: "🥦" },
                            { value: "jain" as const, label: "Jain", emoji: "🌿" },
                            { value: "non-veg" as const, label: "Non-Veg", emoji: "🍗" },
                          ].map((d) => (
                            <button
                              key={d.value}
                              onClick={() => updateResponse(g.id, index, { dietaryPreference: d.value })}
                              className={`flex-1 text-center py-3 rounded-xl border transition-all cursor-pointer ${
                                resp.dietaryPreference === d.value
                                  ? `${t.button} ${t.cardActive}`
                                  : `${t.borderTop} ${t.cardBg} ${t.textSecondary}`
                              }`}
                            >
                              <span className="text-lg block mb-1">{d.emoji}</span>
                              <span className="text-xs font-bold uppercase">{t_i18n(d.value)}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <hr className={t.borderTop} />

                      {/* Accommodation */}
                      {g.tags?.includes("outstation") && (
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className={`font-bold ${t.textPrimary}`}>{t_i18n("accommodationNeeded")}</h4>
                            <p className={`text-xs ${t.textSecondary}`}>{t_i18n("blockedRooms")}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={resp.needsAccommodation}
                              onChange={(e) => updateResponse(g.id, index, { needsAccommodation: e.target.checked })}
                            />
                            <div className={`w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${t.checkbox}`} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {index < (responses[g.id]?.length || 0) - 1 && <div className={`border-t ${t.borderTop} mx-6 my-6`} />}
              </div>
            ))}
          </div>
        ))}
      </main>

      {/* Fixed Bottom CTA */}
      <footer className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 ${t.bg} bg-opacity-90 backdrop-blur-md`}>
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.values(responses).some(resps => resps.some(r => !r.status))}
          className={`w-full py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 ${t.button}`}
        >
          {submitting ? t_i18n("submitting") : t_i18n("confirmRSVP")}
          <span className="material-symbols-outlined">check</span>
        </button>
      </footer>
    </div>
  );
}
