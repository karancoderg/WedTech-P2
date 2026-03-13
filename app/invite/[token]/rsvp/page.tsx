"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { toast } from "sonner";

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

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [responses, setResponses] = useState<FunctionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      if (guestRes.data) setGuest(guestRes.data);
      if (funcRes.data) {
        setFunctions(funcRes.data);
        setResponses(funcRes.data.map((f) => ({
          functionId: f.id, functionName: f.name, status: "", plusOnes: 0,
          children: 0, dietaryPreference: null, needsAccommodation: false,
        })));
      }
      setLoading(false);
    }
    fetchData();
  }, [token]);

  function updateResponse(index: number, updates: Partial<FunctionResponse>) {
    const updated = [...responses];
    updated[index] = { ...updated[index], ...updates };
    setResponses(updated);
  }

  async function handleSubmit() {
    if (responses.some((r) => !r.status)) { toast.error("Please respond to all events"); return; }
    setSubmitting(true);
    try {
      for (const resp of responses) {
        const totalPax = resp.status === "confirmed" ? 1 + resp.plusOnes + resp.children : 0;
        await supabase.from("rsvps").upsert({
          wedding_id: wedding!.id, guest_id: guest!.id, function_id: resp.functionId,
          invite_token: token, status: resp.status, plus_ones: resp.plusOnes,
          children: resp.children, total_pax: totalPax, dietary_preference: resp.dietaryPreference,
          needs_accommodation: resp.needsAccommodation, responded_at: new Date().toISOString(),
        }, { onConflict: "guest_id,function_id" });
      }
      const allConfirmed = responses.every((r) => r.status === "confirmed");
      const allDeclined = responses.every((r) => r.status === "declined");
      await supabase.from("guests").update({ overall_status: allConfirmed ? "confirmed" : allDeclined ? "declined" : "partial" }).eq("id", guest!.id);
      await supabase.from("invite_tokens").update({ used: true }).eq("token", token);
      router.push(`/invite/${token}/confirmed`);
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong — please try again");
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!wedding || !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <p className="text-slate-500">Invalid invitation link</p>
      </div>
    );
  }

  const isOutstation = guest.tags?.includes("outstation");

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
        {responses.map((resp, index) => (
          <div key={resp.functionId}>
            {/* Hero Question */}
            <section className="px-6 pt-8 pb-4 text-center">
              <h3 className={`${t.textPrimary} text-2xl font-bold leading-tight mb-2`}>
                Will you be attending {resp.functionName}?
              </h3>
              <p className={`${t.textSecondary} text-sm`}>Join us for the celebration</p>
            </section>

            {/* Attendance Selection */}
            <div className="px-6 space-y-3 mb-8">
              <label
                className={`relative flex items-center p-4 rounded-xl border-2 ${t.bgSub} shadow-sm cursor-pointer transition-all ${
                  resp.status === "confirmed" ? t.cardActive : t.cardInactive
                }`}
                onClick={() => updateResponse(index, { status: "confirmed" })}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full text-green-600">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                    <span className={`font-semibold text-lg ${resp.status === "confirmed" ? t.textPrimary : t.textSecondary}`}>
                      Yes, I&apos;ll be there
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
                onClick={() => updateResponse(index, { status: "declined", plusOnes: 0, children: 0, dietaryPreference: null, needsAccommodation: false })}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-full text-red-600">
                      <span className="material-symbols-outlined">cancel</span>
                    </div>
                    <span className={`font-semibold text-lg ${resp.status === "declined" ? t.textPrimary : t.textSecondary}`}>
                      Sorry, can&apos;t make it
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
                      <h4 className={`font-bold ${t.textPrimary}`}>Plus-Ones</h4>
                      <span className={`text-xs ${t.textAccent} font-medium uppercase tracking-wider`}>Adults Only</span>
                    </div>
                    <div className={`flex items-center justify-between ${t.cardBg} p-3 rounded-lg border`}>
                      <p className={`${t.textSecondary} text-sm`}>Number of Guests</p>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateResponse(index, { plusOnes: Math.max(0, resp.plusOnes - 1) })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>−</button>
                        <span className={`font-bold ${t.textPrimary} w-4 text-center`}>{resp.plusOnes}</span>
                        <button onClick={() => updateResponse(index, { plusOnes: resp.plusOnes + 1 })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* Children */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`font-bold ${t.textPrimary}`}>Children</h4>
                      <span className={`text-xs ${t.textAccent} font-medium uppercase tracking-wider`}>Below 12 yrs</span>
                    </div>
                    <div className={`flex items-center justify-between ${t.cardBg} p-3 rounded-lg border`}>
                      <p className={`${t.textSecondary} text-sm`}>Number of Kids</p>
                      <div className="flex items-center gap-4">
                        <button onClick={() => updateResponse(index, { children: Math.max(0, resp.children - 1) })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>−</button>
                        <span className={`font-bold ${t.textPrimary} w-4 text-center`}>{resp.children}</span>
                        <button onClick={() => updateResponse(index, { children: resp.children + 1 })} className={`size-8 rounded-full ${t.bgSub} shadow-sm flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop}`}>+</button>
                      </div>
                    </div>
                  </div>

                  <hr className={t.borderTop} />

                  {/* Dietary Preference */}
                  <div>
                    <h4 className={`font-bold ${t.textPrimary} mb-4`}>Dietary Preference</h4>
                    <div className="flex gap-2">
                      {[
                        { value: "veg" as const, label: "Veg", emoji: "🥦" },
                        { value: "jain" as const, label: "Jain", emoji: "🌿" },
                        { value: "non-veg" as const, label: "Non-Veg", emoji: "🍗" },
                      ].map((d) => (
                        <button
                          key={d.value}
                          onClick={() => updateResponse(index, { dietaryPreference: d.value })}
                          className={`flex-1 text-center py-3 rounded-xl border transition-all cursor-pointer ${
                            resp.dietaryPreference === d.value
                              ? `${t.button} ${t.cardActive}`
                              : `${t.borderTop} ${t.cardBg} ${t.textSecondary}`
                          }`}
                        >
                          <span className="text-lg block mb-1">{d.emoji}</span>
                          <span className="text-xs font-bold uppercase">{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <hr className={t.borderTop} />

                  {/* Accommodation */}
                  {isOutstation && (
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`font-bold ${t.textPrimary}`}>Accommodation needed?</h4>
                        <p className={`text-xs ${t.textSecondary}`}>We&apos;ve blocked rooms at the venue</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={resp.needsAccommodation}
                          onChange={(e) => updateResponse(index, { needsAccommodation: e.target.checked })}
                        />
                        <div className={`w-12 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${t.checkbox}`} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {index < responses.length - 1 && <div className={`border-t ${t.borderTop} mx-6 my-6`} />}
          </div>
        ))}
      </main>

      {/* Fixed Bottom CTA */}
      <footer className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 ${t.bg} bg-opacity-90 backdrop-blur-md`}>
        <button
          onClick={handleSubmit}
          disabled={submitting || responses.some((r) => !r.status)}
          className={`w-full py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 ${t.button}`}
        >
          {submitting ? "Submitting..." : "Confirm My RSVP"}
          <span className="material-symbols-outlined">check</span>
        </button>
      </footer>
    </div>
  );
}
