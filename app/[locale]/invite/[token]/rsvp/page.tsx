"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Wedding, Guest, WeddingFunction } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { syncGuestWithCRM } from "@/lib/services/crm-sync";
import QRCode from "qrcode";
import { Great_Vibes, Pinyon_Script, Manrope, Noto_Serif } from "next/font/google";
import { encryptValue } from "@/lib/client-encryption";

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"] });
const pinyonScript = Pinyon_Script({ weight: "400", subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });
const notoSerif = Noto_Serif({ subsets: ["latin"] });


interface FunctionResponse {
  functionId: string;
  functionName: string;
  status: "confirmed" | "declined" | "";
  dietaryPreference: "veg" | "jain" | "non-veg" | null;
  needsAccommodation: boolean;
}

export default function RSVPFormPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const t_i18n = useTranslations("RSVP");
  const t_invite = useTranslations("Invite");
  const locale = useLocale();

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  // Store responses per guest: { [guestId]: FunctionResponse[] }
  const [responses, setResponses] = useState<Record<string, FunctionResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [globalChildrenCount, setGlobalChildrenCount] = useState<number>(0);
  const [guestDietaryPreferences, setGuestDietaryPreferences] = useState<Record<string, "veg" | "jain" | "non-veg" | null>>({});
  const [additionalGuests, setAdditionalGuests] = useState<{ name: string, phone: string, dietaryPreference: "veg" | "jain" | "non-veg" | null }[]>([]);
  const [needsAccommodation, setNeedsAccommodation] = useState<boolean | null>(null);
  const [accommodationCount, setAccommodationCount] = useState<number>(1);

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

  useEffect(() => {
    const validAdditionalGuestsCount = additionalGuests.filter(ag => ag.name.trim()).length;
    const maxChildrenAllowed = guests.length + validAdditionalGuestsCount;
    if (globalChildrenCount > maxChildrenAllowed) {
      setGlobalChildrenCount(maxChildrenAllowed);
    }
  }, [additionalGuests, guests.length, globalChildrenCount]);

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
      const primaryGuest = guests[0];

      for (const guestId of Object.keys(responses)) {
        const guestResponses = responses[guestId];
        const isPrimary = guestId === primaryGuest.id;
        for (const resp of guestResponses) {
          const totalPax = resp.status === "confirmed" ? 1 + (isPrimary ? globalChildrenCount : 0) : 0;
          await supabase.from("rsvps").upsert({
            wedding_id: wedding!.id,
            guest_id: guestId,
            function_id: resp.functionId,
            invite_token: token,
            status: resp.status,
            plus_ones: 0,
            children: isPrimary && resp.status === "confirmed" ? globalChildrenCount : 0,
            total_pax: totalPax,
            dietary_preference: resp.status === "confirmed" ? guestDietaryPreferences[guestId] || null : null,
            needs_accommodation: resp.status === "confirmed" && needsAccommodation === true,
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

      const validAdditionalGuests = additionalGuests.filter(ag => ag.name.trim());
      
      let effectiveGroupId = primaryGuest.group_id;

      // If they don't have a group, create one so they are grouped with their kids/plus ones
      if (validAdditionalGuests.length > 0 && !effectiveGroupId) {
        const { data: newGroup, error: groupError } = await supabase
          .from("guest_groups")
          .insert({
            wedding_id: wedding!.id,
            name: `${primaryGuest.name.split(" ")[0]}'s Family`
          })
          .select()
          .single();

        if (newGroup) {
          effectiveGroupId = newGroup.id;
          // Update primary guest to be part of this new group
          await supabase.from("guests").update({ group_id: effectiveGroupId }).eq("id", primaryGuest.id);
        } else {
          console.error("Failed to create guest group:", groupError);
        }
      }

      for (const ag of validAdditionalGuests) {
        // Create a new guest linked to the primary guest's group
        const { data: newGuest, error: insertError } = await supabase.from("guests").insert({
          wedding_id: wedding!.id,
          group_id: effectiveGroupId || null, // Group them together if we successfully resolved the group
          name: ag.name.trim(),
          phone: await encryptValue(ag.phone.trim()),
          side: primaryGuest.side,
          tags: primaryGuest.tags,
          function_ids: primaryGuest.function_ids,
          invite_token: window.crypto.randomUUID().replace(/-/g, '').slice(0, 16), // Generate a unique token for this new guest
          overall_status: "confirmed",
          imported_via: "manual"
        }).select().single();

        if (insertError) {
          console.error("Failed to insert additional guest:", JSON.stringify(insertError, null, 2));
          toast.error(`Error adding guest ${ag.name.trim()}: ${insertError.message || 'Unknown database error'}`);
        } else if (newGuest) {
          // Add confirmed RSVPs for this new guest, defaulting to the primary guest's responses
          const primaryResponses = responses[primaryGuest.id];
          for (const resp of primaryResponses) {
            await supabase.from("rsvps").upsert({
              wedding_id: wedding!.id,
              guest_id: newGuest.id,
              function_id: resp.functionId,
              invite_token: token,
              status: resp.status, // Copy the primary guest's status
              plus_ones: 0,
              children: 0,
              total_pax: resp.status === "confirmed" ? 1 : 0,
              dietary_preference: resp.status === "confirmed" ? ag.dietaryPreference || null : null,
              needs_accommodation: resp.status === "confirmed" && needsAccommodation === true,
              responded_at: new Date().toISOString(),
            }, { onConflict: "guest_id,function_id" });
          }
          syncGuestWithCRM(newGuest.id);
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

  const themes: Record<string, any> = {
    royal: {
      bg: "bg-[#570000]",
      card: "bg-white/5 backdrop-blur-sm border border-[#e9c349]/20",
      accent: "#e9c349",
      textPrimary: "text-white",
      textSecondary: "text-[#e9c349]/70",
      textAccent: "text-[#e9c349]",
      fontHeading: notoSerif.className,
      fontBody: "font-body",
      button: "bg-gradient-to-r from-[#735c00] via-[#e9c349] to-[#735c00] text-[#241a00] font-bold rounded-sm tracking-[0.2em]",
      input: "bg-white/5 border-[#e9c349]/20 text-white focus:border-[#e9c349] focus:ring-[#e9c349]/20",
      border: "border-[#e9c349]/20",
      borderTop: "border-[#e9c349]/20",
      cardActive: "border-[#e9c349] bg-white/10",
      cardInactive: "border-[#e9c349]/10 hover:border-[#e9c349]/30",
      cardBg: "bg-white/5 backdrop-blur-sm border-[#e9c349]/20",
      icon: "text-[#e9c349]",
      iconBg: "bg-[#e9c349]",
      bgSub: "bg-[#570000]/80",
      checkbox: "peer-checked:bg-[#e9c349]",
      customBg: "mandala-pattern"
    },
    minimal: {
      bg: "bg-[#f6f4fa]",
      card: "bg-white/90 backdrop-blur-md border border-purple-200/50 shadow-sm",
      accent: "#4a2e6b",
      textPrimary: "text-[#2a173d]",
      textSecondary: "text-[#4a2e6b]/70",
      textAccent: "text-[#4a2e6b]",
      fontHeading: greatVibes.className + " tracking-normal",
      fontBody: manrope.className,
      button: "bg-purple-50 text-[#4a2e6b] border border-purple-200/50 hover:bg-purple-100 rounded-xl tracking-widest uppercase font-bold shadow-sm",
      input: "bg-white border-purple-200/50 text-[#2a173d] focus:border-[#4a2e6b] focus:ring-[#4a2e6b]/10",
      border: "border-purple-200/50",
      borderTop: "border-purple-200/50",
      cardActive: "border-[#4a2e6b] bg-purple-50",
      cardInactive: "border-purple-200/50 hover:border-purple-300",
      cardBg: "bg-white/90 border-purple-200/50",
      icon: "text-[#4a2e6b]",
      iconBg: "bg-[#f6f4fa]",
      bgSub: "bg-[#f6f4fa]/90",
      checkbox: "peer-checked:bg-[#4a2e6b]",
      customBg: ""
    },
    floral: {
      bg: "bg-[#faf9f6]",
      card: "bg-white/80 backdrop-blur-md border border-[#7b5455]/10 shadow-sm",
      accent: "#7b5455",
      textPrimary: "text-[#1a1c1a]",
      textSecondary: "text-[#4f4443]/70",
      textAccent: "text-[#7b5455]",
      fontHeading: notoSerif.className,
      fontBody: manrope.className,
      button: "bg-[#7b5455] text-white rounded-sm shadow-lg tracking-widest uppercase font-bold",
      input: "bg-white border-[#7b5455]/20 text-[#1a1c1a] focus:border-[#7b5455] focus:ring-[#7b5455]/10",
      border: "border-[#7b5455]/10",
      borderTop: "border-[#7b5455]/10",
      cardActive: "border-[#7b5455] bg-[#7b5455]/5",
      cardInactive: "border-[#7b5455]/5 hover:border-[#7b5455]/20",
      cardBg: "bg-white/80 border-[#7b5455]/10",
      icon: "text-[#7b5455]",
      iconBg: "bg-[#7b5455]",
      bgSub: "bg-[#faf9f6]/90",
      checkbox: "peer-checked:bg-[#7b5455]",
      customBg: "vellum-texture"
    },
    dark: {
      bg: "bg-[#0b141f]",
      card: "bg-[#18202c] border border-[#f2ca50]/10 shadow-xl",
      accent: "#f2ca50",
      textPrimary: "text-[#dae3f3]",
      textSecondary: "text-[#7f735a]",
      textAccent: "text-[#f2ca50]",
      fontHeading: notoSerif.className + " italic",
      fontBody: manrope.className,
      button: "bg-[#f2ca50] text-[#0b141f] rounded-lg shadow-xl font-bold uppercase tracking-widest",
      input: "bg-[#0b141f] border-[#f2ca50]/20 text-[#dae3f3] focus:border-[#f2ca50] focus:ring-[#f2ca50]/10",
      border: "border-[#f2ca50]/10",
      borderTop: "border-[#f2ca50]/10",
      cardActive: "border-[#f2ca50] bg-[#f2ca50]/10",
      cardInactive: "border-[#f2ca50]/5 hover:border-[#f2ca50]/20",
      cardBg: "bg-[#18202c] border-[#f2ca50]/10",
      icon: "text-[#f2ca50]",
      iconBg: "bg-[#f2ca50]",
      bgSub: "bg-[#0b141f]/80",
      checkbox: "peer-checked:bg-[#f2ca50]",
      customBg: "gold-glow"
    },
    bohemian: {
      bg: "bg-[#f4f4f4]",
      card: "bg-white border text-center rounded-none shadow-sm",
      accent: "#18362b",
      textPrimary: "text-[#1c1c19]",
      textSecondary: "text-[#54433e]/70",
      textAccent: "text-[#18362b]",
      fontHeading: notoSerif.className,
      fontBody: manrope.className,
      button: "bg-[#18362b] text-white rounded-none shadow-md tracking-widest uppercase font-bold text-xs",
      input: "bg-white/50 border-[#18362b]/20 text-[#1c1c19] focus:border-[#18362b] focus:ring-[#18362b]/10 rounded-none",
      border: "border-[#18362b]/10",
      borderTop: "border-[#18362b]/10",
      cardActive: "border-[#18362b] bg-[#18362b]/5",
      cardInactive: "border-[#18362b]/5 hover:border-[#18362b]/20",
      cardBg: "bg-white border-[#18362b]/10 rounded-none",
      icon: "text-[#18362b]",
      iconBg: "bg-[#18362b]",
      bgSub: "bg-[#f4f4f4]/90",
      checkbox: "peer-checked:bg-[#18362b]",
      customBg: "none"
    }
  };

  const t = themes[wedding.template_id as string] || themes.floral;

  if (showCompleted) {
    return (
      <div className={`relative flex min-h-screen w-full flex-col max-w-md mx-auto transition-colors duration-500 ${t.bg}`}>
      <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-md relative h-full overflow-hidden">
          {wedding.template_id === 'floral' ? (
            <>
              <div className="absolute inset-0 bg-[#fffdfa]" />
              <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-95 mix-blend-multiply h-auto" style={{ maxHeight: '300px', objectPosition: 'top center' }} />
              <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply h-auto" style={{ maxHeight: '350px', objectPosition: 'bottom center' }} />
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
            <img src="/images/watercolor_bg.png" alt="background" className="w-full h-full object-cover opacity-40 z-[-1]" />
          )}
        </div>
      </div>
      <header className={`relative z-50 flex items-center ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'bg-transparent pt-[240px] border-none' : wedding.template_id === 'bohemian' ? 'bg-transparent pt-[160px] border-none' : wedding.template_id === 'dark' ? 'bg-transparent pt-[80px] border-none' : `${t.card} backdrop-blur-md border-b ${t.border}`} px-4 py-4 justify-between`}>
        <div className={`${t.textPrimary} flex size-10 shrink-0 items-center justify-center`}>
          {/* Logo or placeholder */}
        </div>
        <div className="flex-1 flex flex-col items-center">
          <h2 className={`${['minimal', 'floral', 'dark'].includes(wedding.template_id as string) ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'dark' ? 'text-[#f2d080] text-5xl leading-none drop-shadow-lg' : wedding.template_id === 'bohemian' ? 'text-white text-3xl font-black drop-shadow-sm' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-4xl leading-none' : 'text-3xl'}`} font-normal text-center py-1`}>
            {wedding.bride_name}
          </h2>
          {wedding.template_id !== 'dark' && (
            <span className={`${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'bohemian' ? 'text-white font-black text-xl py-1 drop-shadow-sm' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-2xl mt-1' : 'text-xl mx-2'}`}`}>
              {(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'With' : '&'}
            </span>
          )}
          <h2 className={`${['minimal', 'floral', 'dark'].includes(wedding.template_id as string) ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'dark' ? 'text-[#f2d080] text-5xl leading-none mt-2 drop-shadow-lg' : wedding.template_id === 'bohemian' ? 'text-white text-3xl font-black drop-shadow-sm' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-4xl leading-none mt-1' : 'text-3xl'}`} font-normal text-center py-1`}>
            {wedding.groom_name}
          </h2>
        </div>
        <div className="size-10 shrink-0" />
      </header>

      <main className={`relative z-10 flex-1 px-6 pb-24 text-center ${wedding.template_id === 'minimal' ? 'pt-8' : 'pt-12'}`}>
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
                {guests.length > 1 ? t_i18n("familyCheckInPass") : t_i18n("personalCheckInPass")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {guests.map(g => (
                  <div key={g.id} className={`${t.textPrimary} flex items-center gap-2 font-bold px-3 py-1 rounded-full bg-white/50 text-sm border ${t.borderTop}`}>
                    {g.name}
                    {g.side && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase tracking-tighter ${g.side === 'bride' ? 'bg-pink-100 border-pink-200 text-pink-600' :
                          g.side === 'groom' ? 'bg-blue-100 border-blue-200 text-blue-600' :
                            'bg-purple-100 border-purple-200 text-purple-600'
                        }`}>
                        {g.side}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-10 pt-8 border-t ${t.borderTop} flex flex-col items-center gap-2`}>
              <p className="text-xs text-slate-400 font-medium">{t_i18n("scanAtEntrance")}</p>
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-slate-400">confirmation_number</span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{t_i18n("tokenText")} {token.slice(0, 8)}...</span>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="mt-8 flex justify-center gap-6 w-full">
              {['en', 'hi'].map((l) => (
                <button
                  key={l}
                  onClick={() => router.push(`/${l}/invite/${token}/rsvp`)}
                  className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                    locale === l 
                      ? 'border-b-inherit opacity-100' 
                      : 'border-b-transparent opacity-40 hover:opacity-100'
                  }`}
                  style={locale === l ? { borderBottomColor: t.textPrimary ? undefined : "currentColor" } : {}}
                >
                  <span className={t.textPrimary}>{l === 'en' ? t_invite("english") : t_invite("hindi")}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push(`/invite/${token}`)}
            className={`mt-12 w-full py-4 rounded-xl border-2 ${t.borderTop} ${t.textPrimary} font-bold flex items-center justify-center gap-2 hover:bg-white/50 transition-all`}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            {t_i18n("backToInvitation")}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-screen w-full flex-col max-w-md mx-auto transition-colors duration-500 ${t.bg}`}>
      <div className="absolute inset-0 z-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-md relative h-full overflow-hidden">
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
            <img src="/images/watercolor_bg.png" alt="background" className="w-full h-full object-cover opacity-40 z-[-1]" />
          )}
        </div>
      </div>
      {/* Sticky Header */}
      <header className={`relative z-50 flex flex-col items-center ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'bg-transparent pt-[240px] border-none' : wedding.template_id === 'royal' ? 'bg-transparent pt-0 border-none' : wedding.template_id === 'dark' ? 'bg-transparent pt-[80px] border-none' : wedding.template_id === 'bohemian' ? 'bg-transparent pt-[160px] border-none' : `${t.bgSub} backdrop-blur-md border-b ${t.borderTop}`} px-4 py-4 justify-between`}>
        <div className={`absolute top-4 left-4 z-[60] ${t.textPrimary} flex size-10 shrink-0 items-center justify-center cursor-pointer bg-white/20 backdrop-blur-md rounded-full`} onClick={() => router.back()}>
          <span className="material-symbols-outlined">close</span>
        </div>

        {/* Royal Theme: Motif + Script Names (below background lace) */}
        {wedding.template_id === 'royal' && (
          <div className="w-full flex flex-col items-center pt-[220px]">
            {/* Invited To */}
            <p className={`${notoSerif.className} text-[#deb771] text-[9px] font-bold tracking-[0.3em] uppercase mb-3`}>{t_invite("invitedTo")}</p>
            {/* Bride Name */}
            <h1 className={`${greatVibes.className} text-6xl text-[#ebc98b] leading-tight text-center`} style={{ textShadow: '1px 2px 4px rgba(0,0,0,0.4)' }}>{wedding.bride_name}</h1>
            <h1 className={`${greatVibes.className} text-4xl text-[#deb771] my-1`}>&amp;</h1>
            <h1 className={`${greatVibes.className} text-6xl text-[#ebc98b] leading-tight text-center mb-4`} style={{ textShadow: '1px 2px 4px rgba(0,0,0,0.4)' }}>{wedding.groom_name}</h1>
          </div>
        )}

        {/* Non-Royal themes header */}
        {wedding.template_id !== 'royal' && (
          <div className="flex-1 flex flex-col items-center w-full">
            <h2 className={`${['minimal', 'floral', 'dark'].includes(wedding.template_id as string) ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'dark' ? 'text-[#f2d080] text-5xl leading-none drop-shadow-lg' : wedding.template_id === 'bohemian' ? 'text-white text-5xl font-black drop-shadow-md tracking-wide' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-4xl leading-none' : 'text-3xl'}`} font-normal text-center py-1`}>
              {wedding.bride_name}
            </h2>
            {wedding.template_id !== 'dark' && (
              <span className={`${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'bohemian' ? 'text-white font-black text-3xl py-1 drop-shadow-sm' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-2xl mt-1' : 'text-xl mx-2'}`}`}>
                {(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? t_i18n("with") : '&'}
              </span>
            )}
            <h2 className={`${['minimal', 'floral', 'dark'].includes(wedding.template_id as string) ? greatVibes.className : t.fontHeading} ${wedding.template_id === 'dark' ? 'text-[#f2d080] text-5xl leading-none mt-2 drop-shadow-lg' : wedding.template_id === 'bohemian' ? 'text-white text-5xl font-black drop-shadow-md tracking-wide' : `${t.textAccent} ${(wedding.template_id === 'minimal' || wedding.template_id === 'floral') ? 'text-4xl leading-none mt-1' : 'text-3xl'}`} font-normal text-center py-1`}>
              {wedding.groom_name}
            </h2>
          </div>
        )}
      </header>

      <main className={`relative z-10 flex-1 overflow-y-auto pb-48 pt-4`}>
        {guests.map((g, gIdx) => (
          <div key={g.id} className={gIdx > 0 ? `border-t-4 ${t.borderTop} mt-12 pt-8` : ""}>
            {/* Guest Name Header */}
            {guests.length > 1 && (
              <div className="px-6 mb-4">
                <div className={`${t.cardBg} border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm`}>
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${t.icon}`}>person</span>
                    <span className={`${t.textPrimary} text-xl font-black`}>{g.name}</span>
                  </div>
                  {g.side && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full border ${g.side === 'bride' ? 'bg-pink-50 border-pink-200 text-pink-500' :
                        g.side === 'groom' ? 'bg-blue-50 border-blue-200 text-blue-500' :
                          'bg-purple-50 border-purple-200 text-purple-500'
                      }`}>
                      {g.side === 'both' ? t_i18n("bothSides") : `${g.side}${t_i18n("side")}`}
                    </span>
                  )}
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
                    className={`relative flex items-center p-4 rounded-xl border-2 ${t.bgSub} shadow-sm cursor-pointer transition-all ${resp.status === "confirmed" ? t.cardActive : t.cardInactive
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
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${resp.status === "confirmed" ? t.cardActive : t.borderTop
                        }`}>
                        {resp.status === "confirmed" && <div className={`w-3 h-3 ${t.iconBg} rounded-full`} />}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`relative flex items-center p-4 rounded-xl border-2 ${t.bgSub} shadow-sm cursor-pointer transition-all ${resp.status === "declined" ? "border-red-400" : t.cardInactive
                      }`}
                    onClick={() => updateResponse(g.id, index, { status: "declined", dietaryPreference: null, needsAccommodation: false })}
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
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${resp.status === "declined" ? "border-red-400" : "border-slate-200"}`}>
                        {resp.status === "declined" && <div className="w-3 h-3 bg-red-400 rounded-full" />}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Conditional Detail Form */}
                {resp.status === "confirmed" && g.tags?.includes("outstation") && (
                  <div className="px-6 space-y-6 animate-in fade-in cursor-pointer">
                    <div className={`${t.bgSub} rounded-xl p-5 shadow-sm space-y-6 border ${t.borderTop}`}>
                      {/* Accommodation */}
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
                    </div>
                  </div>
                )}

                {index < (responses[g.id]?.length || 0) - 1 && <div className={`border-t ${t.borderTop} mx-6 my-6`} />}
              </div>
            ))}

            {/* Guest Dietary Preference */}
            {responses[g.id]?.some(r => r.status === "confirmed") && (
              <div className="px-6 mt-6 pb-6 animate-in fade-in">
                <div className="mb-3">
                  <h4 className={`${t.textPrimary} font-bold text-sm uppercase tracking-widest`}>
                    {t_i18n("dietaryPreference") || "Dietary Preference"} <span className="text-xs font-normal text-slate-400 normal-case">(Optional)</span>
                  </h4>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: "veg" as const, label: "Veg", emoji: "🥦" },
                    { value: "jain" as const, label: "Jain", emoji: "🌿" },
                    { value: "non-veg" as const, label: "Non-Veg", emoji: "🍗", transKey: "nonVeg" as const },
                  ].map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setGuestDietaryPreferences(prev => ({ ...prev, [g.id]: d.value === prev[g.id] ? null : d.value }))}
                      className={`flex-1 text-center py-2 rounded-xl border transition-all cursor-pointer ${guestDietaryPreferences[g.id] === d.value
                          ? `${t.button} ${t.cardActive}`
                          : `${t.borderTop} ${t.cardBg} ${t.textSecondary}`
                        }`}
                    >
                      <span className="text-sm block mb-1">{d.emoji}</span>
                      <span className="text-[10px] font-bold uppercase">{t_i18n((d as any).transKey || d.value) || d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Global Additional Guests & Children Section */}
        {Object.values(responses).some(resps => resps.some(r => r.status === "confirmed")) && (
          <div className={`border-t-4 ${t.borderTop} mt-12 pt-8 px-6 space-y-8 pb-10`}>
            {/* Additional Guests */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${t.textPrimary} text-xl font-bold leading-tight`}>
                  {t_i18n("bringingAdditionalGuests")}
                </h3>
              </div>
              <p className={`${t.textSecondary} text-sm mb-4`}>
                {t_i18n("provideDetails")}
              </p>

              <div className="space-y-4">
                {additionalGuests.map((ag, index) => (
                  <div key={index} className={`p-4 rounded-xl border ${t.borderTop} ${t.cardBg} space-y-3 relative`}>
                    <button
                      onClick={() => setAdditionalGuests(prev => prev.filter((_, i) => i !== index))}
                      className="absolute -top-3 -right-3 size-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center border border-red-200 shadow-sm hover:bg-red-200"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <div>
                      <label className={`text-xs font-bold uppercase tracking-widest ${t.textSecondary} mb-1 block`}>{t_i18n("guestName")}</label>
                      <input
                        type="text"
                        placeholder="E.g. John Doe"
                        value={ag.name}
                        onChange={(e) => {
                          const newGuests = [...additionalGuests];
                          newGuests[index].name = e.target.value;
                          setAdditionalGuests(newGuests);
                        }}
                        className={`w-full p-3 rounded-lg border ${t.borderTop} focus:outline-none focus:border-[${t.icon}] bg-white`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-bold uppercase tracking-widest ${t.textSecondary} mb-1 block`}>{t_i18n("mobileNumber")}</label>
                      <input
                        type="tel"
                        placeholder="E.g. +91 98765 43210"
                        value={ag.phone}
                        onChange={(e) => {
                          const newGuests = [...additionalGuests];
                          newGuests[index].phone = e.target.value;
                          setAdditionalGuests(newGuests);
                        }}
                        className={`w-full p-3 rounded-lg border ${t.borderTop} focus:outline-none focus:border-[${t.icon}] bg-white`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-bold uppercase tracking-widest ${t.textSecondary} mb-1 block`}>{t_i18n("dietaryPreferenceOptional")}</label>
                      <div className="flex gap-2">
                        {[
                          { value: "veg" as const, label: "Veg", emoji: "🥦" },
                          { value: "jain" as const, label: "Jain", emoji: "🌿" },
                          { value: "non-veg" as const, label: "Non-Veg", emoji: "🍗", transKey: "nonVeg" as const },
                        ].map((d) => (
                          <button
                            key={d.value}
                            onClick={() => {
                              const newGuests = [...additionalGuests];
                              newGuests[index].dietaryPreference = newGuests[index].dietaryPreference === d.value ? null : d.value;
                              setAdditionalGuests(newGuests);
                            }}
                            className={`flex-1 text-center py-2 rounded-xl border transition-all cursor-pointer ${ag.dietaryPreference === d.value
                                ? `${t.button} ${t.cardActive}`
                                : `${t.borderTop} ${t.cardBg} ${t.textSecondary}`
                              }`}
                          >
                            <span className="text-lg block mb-1">{d.emoji}</span>
                            <span className="text-xs font-bold uppercase">{t_i18n((d as any).transKey || d.value) || d.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setAdditionalGuests(prev => [...prev, { name: "", phone: "", dietaryPreference: null }])}
                className={`w-full mt-4 py-3 rounded-xl border-2 border-dashed ${t.borderTop} ${t.textAccent} font-semibold flex items-center justify-center gap-2 hover:bg-black/5 transition-all`}
              >
                <span className="material-symbols-outlined">person_add</span>
                {t_i18n("addGuest")}
              </button>
            </div>

            <hr className={t.borderTop} />



            {/* Accommodation */}
            <div>
              <div className="mb-1">
                <h3 className={`${t.textPrimary} text-xl font-bold leading-tight`}>🏨 {t_i18n("accommodation")}</h3>
                <p className={`${t.textSecondary} text-sm mt-1`}>{t_i18n("requireAccommodation")}</p>
              </div>

              {/* Yes / No */}
              <div className="flex gap-3 mt-4">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => {
                      setNeedsAccommodation(val);
                      if (val) {
                        const totalConfirmedMembers = guests.filter(g => Object.values(responses).some(resps => resps.some(r => r.status === 'confirmed')));
                        setAccommodationCount(totalConfirmedMembers.length || 1);
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                      needsAccommodation === val
                        ? `${t.button} border-transparent`
                        : `${t.cardBg} ${t.borderTop} ${t.textSecondary}`
                    }`}
                  >
                    {val ? t_i18n("yesNeedIt") : t_i18n("noThanks")}
                  </button>
                ))}
              </div>

              {/* Count picker — only show if Yes */}
              {needsAccommodation === true && (
                <div className={`mt-4 ${t.cardBg} border rounded-xl p-4 shadow-sm space-y-3`}>
                  <p className={`${t.textSecondary} text-sm font-medium`}>{t_i18n("howManyAccommodation")}</p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAccommodationCount(prev => Math.max(1, prev - 1))}
                      className={`size-10 rounded-full ${t.bgSub} shadow flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop} text-xl`}
                    >−</button>
                    <span className={`font-black text-2xl ${t.textPrimary} w-8 text-center`}>{accommodationCount}</span>
                    <button
                      onClick={() => setAccommodationCount(prev => prev + 1)}
                      className={`size-10 rounded-full ${t.bgSub} shadow flex items-center justify-center ${t.textAccent} font-bold border ${t.borderTop} text-xl`}
                    >+</button>
                    {/* All button */}
                    <button
                      onClick={() => {
                        const validAdditional = additionalGuests.filter(ag => ag.name.trim()).length;
                        const totalMembers = guests.length + validAdditional + globalChildrenCount;
                        setAccommodationCount(totalMembers);
                      }}
                      className={`ml-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border-2 ${t.borderTop} ${t.textAccent} ${t.cardBg} hover:opacity-80 transition-all`}
                    >
                      {t_i18n("all")} ({guests.length + additionalGuests.filter(ag => ag.name.trim()).length + globalChildrenCount})
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Language Switcher for RSVP Form */}
        <div className="mt-8 flex justify-center gap-6 z-20 pb-12 w-full">
          {['en', 'hi'].map((l) => (
            <button
              key={l}
              onClick={() => router.push(`/${l}/invite/${token}/rsvp`)}
              className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                locale === l 
                  ? 'border-b-inherit opacity-100' 
                  : 'border-b-transparent opacity-60 hover:opacity-100'
              }`}
              style={locale === l ? { borderBottomColor: t.textPrimary ? undefined : "currentColor" } : {}}
            >
              <span className={t.textPrimary}>{l === 'en' ? t_invite("english") : t_invite("hindi")}</span>
            </button>
          ))}
        </div>
      </main>

      {/* Fixed Bottom CTA */}
      <footer className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 z-50 ${['minimal', 'floral', 'dark', 'bohemian', 'royal'].includes(wedding.template_id as string) ? 'bg-transparent pb-8' : `${t.bg} bg-opacity-90 backdrop-blur-md`}`}>
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.values(responses).some(resps => resps.some(r => !r.status))}
          className={`w-full py-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 ${wedding.template_id === 'royal' ? `bg-transparent border-2 border-[#deb771]/40 text-[#ebc98b] font-bold tracking-[0.2em] uppercase text-sm hover:bg-[#deb771]/10 ${notoSerif.className}` : t.button}`}
        >
          {submitting ? t_i18n("submitting") : t_i18n("confirmRSVP")}
          <span className="material-symbols-outlined">check</span>
        </button>
      </footer>
    </div>
  );
}
