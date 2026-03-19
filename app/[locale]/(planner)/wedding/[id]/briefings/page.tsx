"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"] });
import type { Wedding, WeddingFunction, RSVP } from "@/lib/types";
import { toast } from "sonner";

export default function VendorBriefingPage() {
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
      supabase.from("rsvps").select("*, guests(*)").eq("wedding_id", weddingId).eq("status", "confirmed"),
    ]);

    if (weddingRes.data) setWedding(weddingRes.data);
    if (funcRes.data) setFunctions(funcRes.data);
    if (rsvpRes.data) setRsvps(rsvpRes.data as any);
    setLoading(false);
  }, [weddingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadCateringBriefing = () => {
    const data = functions.map(f => {
      const funcRsvps = rsvps.filter(r => r.function_id === f.id);
      const totalPax = funcRsvps.reduce((sum, r) => sum + r.total_pax, 0);
      const veg = funcRsvps.filter(r => r.dietary_preference === "veg").reduce((sum, r) => sum + r.total_pax, 0);
      const jain = funcRsvps.filter(r => r.dietary_preference === "jain").reduce((sum, r) => sum + r.total_pax, 0);
      const nonVeg = funcRsvps.filter(r => r.dietary_preference === "non-veg").reduce((sum, r) => sum + r.total_pax, 0);

      return {
        "Function Name": f.name,
        "Date": f.date,
        "Confirmed Pax": totalPax,
        "Veg Count": veg,
        "Jain Count": jain,
        "Non-Veg Count": nonVeg,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catering Brief");
    XLSX.writeFile(workbook, `Catering_Briefing_${wedding?.wedding_name}.xlsx`);
    toast.success("Catering briefing downloaded!");
  };

  const downloadGuestBriefing = () => {
    const data = rsvps.map(r => ({
      "Guest Name": (r as any).guests?.name,
      "Phone": (r as any).guests?.phone,
      "Email": (r as any).guests?.email || "N/A",
      "Function": functions.find(f => f.id === r.function_id)?.name,
      "Pax": r.total_pax,
      "Plus Ones": r.plus_ones,
      "Children": r.children,
      "Dietary": r.dietary_preference,
      "Accommodation": r.needs_accommodation ? "Needed" : "Not Needed",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Guest Details");
    XLSX.writeFile(workbook, `Guest_Briefing_${wedding?.wedding_name}.xlsx`);
    toast.success("Guest briefing downloaded!");
  };

  const downloadSeatingBriefing = async () => {
    toast.info("Preparing seating report...");
    
    try {
      // 1. Fetch tables and assignments
      const { data: tablesData } = await supabase
        .from("seating_tables")
        .select("*")
        .eq("wedding_id", weddingId);
      
      if (!tablesData || tablesData.length === 0) {
        toast.error("No seating tables found.");
        return;
      }

      const { data: assignmentsData } = await supabase
        .from("guest_seating")
        .select("*, guests(*), seating_tables(*)")
        .in("table_id", tablesData.map(t => t.id));

      if (!assignmentsData || assignmentsData.length === 0) {
        toast.error("No seating assignments found to export.");
        return;
      }

      // 2. Format data
      const data = assignmentsData.map(a => {
        const guest = a.guests as any;
        const table = a.seating_tables as any;
        const func = functions.find(f => f.id === table.function_id);
        
        return {
          "Table Name": table.name,
          "Guest Name": guest.name,
          "Function": func?.name || "N/A",
          "Side": guest.side,
          "Tags": (guest.tags || []).join(", "),
        };
      });

      // 3. Sort by function then table
      data.sort((a, b) => a.Function.localeCompare(b.Function) || a["Table Name"].localeCompare(b["Table Name"]));

      // 4. Generate Excel
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Seating Assignments");
      XLSX.writeFile(workbook, `Seating_Briefing_${wedding?.wedding_name}.xlsx`);
      toast.success("Seating briefing downloaded!");
    } catch (error) {
      console.error("Seating export error:", error);
      toast.error("Failed to generate seating report.");
    }
  };

  if (loading) return <div className="p-8 animate-pulse text-slate-400">Loading briefings...</div>;

  return (
    <div className="space-y-16 pb-32">
      <div className="text-center">
        <h2 className={`text-3xl md:text-4xl uppercase tracking-widest text-[#5C4033] mb-4 ${playfair.className}`}>Vendor Briefing Generator</h2>
        <p className="text-[11px] font-medium tracking-widest uppercase text-[#8C7A6B]">Export operational reports for your catering, logistics, and decor teams.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto pt-8">
        {/* Catering Card */}
        <div className="bg-white rounded-t-[150px] rounded-b-md border border-[#EBE3D5] p-10 pt-16 hover:shadow-xl transition-all flex flex-col items-center text-center group h-full shadow-lg">
          <div className="text-[#8C7A6B] flex items-center justify-center mb-8 opacity-60">
            <span className="material-symbols-outlined text-4xl">restaurant</span>
          </div>
          <h3 className={`text-xl uppercase tracking-widest text-[#5C4033] mb-6 ${playfair.className}`}>Catering Briefing</h3>
          <p className="text-[#8C7A6B] text-[10px] tracking-wider leading-relaxed mb-auto pb-12">Headcounts for Veg, Jain, and Non-Veg per function based on real confirmed RSVPs.</p>
          <button
            onClick={downloadCateringBriefing}
            className="w-full py-4 bg-[#5C4033] text-white font-bold hover:bg-[#4A3228] transition-all flex items-center justify-center gap-2 tracking-[0.2em] uppercase text-[9px]"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Excel
          </button>
        </div>

        {/* Guest Logistics Card */}
        <div className="bg-[#5C4033] shadow-2xl transform md:scale-110 z-10 rounded-t-[150px] rounded-b-md border border-[#5C4033] p-10 pt-20 hover:shadow-2xl transition-all flex flex-col items-center text-center group h-full">
          <div className="text-white flex items-center justify-center mb-8 opacity-80">
            <span className="material-symbols-outlined text-4xl">hotel</span>
          </div>
          <h3 className={`text-xl uppercase tracking-widest !text-white mb-6 ${playfair.className}`}>Logistics &<br/>Accommodation</h3>
          <p className="!text-white/80 text-[10px] tracking-wider leading-relaxed mb-auto pb-12">Detailed list of guests requiring accommodation and travel assistance.</p>
          <button
            onClick={downloadGuestBriefing}
            className="w-full py-4 bg-white text-[#5C4033] font-bold hover:bg-[#F2ECE4] transition-all flex items-center justify-center gap-2 tracking-[0.2em] uppercase text-[9px]"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Excel
          </button>
        </div>

        {/* Decor/Seating Card */}
        <div className="bg-white rounded-t-[150px] rounded-b-md border border-[#EBE3D5] p-10 pt-16 hover:shadow-xl transition-all flex flex-col items-center text-center group h-full shadow-lg">
          <div className="text-[#8C7A6B] flex items-center justify-center mb-8 opacity-60">
            <span className="material-symbols-outlined text-4xl">table_chart</span>
          </div>
          <h3 className={`text-xl uppercase tracking-widest text-[#5C4033] mb-6 ${playfair.className}`}>Seating Briefing</h3>
          <p className="text-[#8C7A6B] text-[10px] tracking-wider leading-relaxed mb-auto pb-12">Complete table assignments per function for the decor team and coordinators.</p>
          <button
            onClick={downloadSeatingBriefing}
            className="w-full py-4 bg-[#5C4033] text-white font-bold hover:bg-[#4A3228] transition-all flex items-center justify-center gap-2 tracking-[0.2em] uppercase text-[9px]"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
}
