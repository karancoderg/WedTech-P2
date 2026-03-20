import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseRSVPFromTranscript } from "@/lib/rsvp-parser";

const TABBLY_API_KEY = process.env.TABBLY_API_KEY || "";
const TABBLY_ORGANIZATION_ID = process.env.TABBLY_ORGANIZATION_ID || "";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: weddingId } = await params;

    if (!TABBLY_API_KEY || !TABBLY_ORGANIZATION_ID) {
      return NextResponse.json({ error: "Tabbly credentials missing" }, { status: 500 });
    }

    // Fetch latest 100 call logs from Tabbly
    const response = await fetch(`https://www.tabbly.io/dashboard/agents/endpoints/call-logs-v2?api_key=${TABBLY_API_KEY}&organization_id=${TABBLY_ORGANIZATION_ID}&limit=100`);
    
    if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch Tabbly logs" }, { status: 502 });
    }

    const result = await response.json();
    if (result.status !== "success") {
        return NextResponse.json({ error: result.message || "Unknown Tabbly error" }, { status: 502 });
    }

    const logs = result.data || [];
    let updatedCount = 0;

    for (const log of logs) {
        const guestId = log.custom_identifiers; 
        const transcript = log.call_transcript || log.call_summary || "";

        if (!guestId) continue;

        const dataSource = log.variables || log.extracted_data || {};

        let status = "pending";
        let pax = 0;
        let dietary = null;

        if (dataSource.rsvp_status) {
            status = String(dataSource.rsvp_status).toLowerCase().trim();
            pax = parseInt(dataSource.guest_count) || (status === "confirmed" ? 1 : 0);
            dietary = dataSource.dietary_preference || null;
        } else {
            // Approach C: Fallback to local transcript parsing
            const parsed = await parseRSVPFromTranscript(transcript);
            status = parsed.status;
            pax = parsed.total_pax;
            dietary = parsed.dietary_preference;
        }

        if (status === "pending") continue;

        // --- Database Update logic ---
        // 1. Update Guest status
        const { error: guestUpdateError } = await supabase.from("guests")
            .update({ overall_status: status })
            .eq("id", guestId)
            .eq("wedding_id", weddingId); // Security check

        if (guestUpdateError) continue;

        // 2. Fetch the guest to get function_ids (or we could fetch all at once initially)
        const { data: guest } = await supabase.from("guests").select("function_ids").eq("id", guestId).single();

        if (guest && guest.function_ids) {
            for (const functionId of guest.function_ids) {
                const { data: existingRSVP } = await supabase
                    .from("rsvps")
                    .select("id")
                    .eq("guest_id", guestId)
                    .eq("function_id", functionId)
                    .single();

                if (existingRSVP) {
                    await supabase.from("rsvps").update({
                        status: status,
                        total_pax: status === "confirmed" ? pax : 0,
                        dietary_preference: dietary,
                        responded_at: log.called_time // Use the call time from Tabbly as responded_at
                    }).eq("id", existingRSVP.id);
                } else {
                    await supabase.from("rsvps").insert({
                        wedding_id: weddingId,
                        guest_id: guestId,
                        function_id: functionId,
                        status: status,
                        total_pax: status === "confirmed" ? pax : 0,
                        dietary_preference: dietary,
                        responded_at: log.called_time
                    });
                }
            }
        }
        updatedCount++;
    }

    return NextResponse.json({ 
        success: true, 
        message: `Synced ${updatedCount} RSVPs from Tabbly logs.`,
        logs_processed: logs.length
    });

  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
