import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";
import { parseRSVPFromTranscript } from "@/lib/rsvp-parser";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Tabbly Webhook Received:", JSON.stringify(payload, null, 2));

    const guestId = payload.custom_identifiers;
    const transcript = payload.transcript || payload.summary || "";
    
    if (!guestId) {
      return NextResponse.json({ error: "No guest identifier found" }, { status: 400 });
    }

    // Approach B: Try reading extracted variables from Tabbly first
    let status = "pending";
    let pax = 0;
    let dietary = null;

    const dataSource = payload.variables || payload.extracted_data || {};
    
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

    // Update Guest status
    if (status !== "pending") {
        await supabase.from("guests").update({
            overall_status: status
        }).eq("id", guestId);

        // Fetch the guest to get wedding_id and function_ids
        const { data: guest } = await supabase.from("guests").select("wedding_id, function_ids").eq("id", guestId).single();

        if (guest && guest.function_ids) {
            // Update or Insert RSVP records for each function
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
                        responded_at: new Date().toISOString()
                    }).eq("id", existingRSVP.id);
                } else {
                    await supabase.from("rsvps").insert({
                        wedding_id: guest.wedding_id,
                        guest_id: guestId,
                        function_id: functionId,
                        status: status,
                        total_pax: status === "confirmed" ? pax : 0,
                        dietary_preference: dietary,
                        responded_at: new Date().toISOString()
                    });
                }
            }
        }
    }

    // Log the communication outcome
    await supabase.from("communication_logs").insert({
        guest_id: guestId,
        type: "call_callback",
        status: payload.status,
        payload: {
            transcript: encrypt(transcript),
            parsed: { status, pax, dietary }
        }
    });

    return NextResponse.json({ success: true, parsed: { status, pax, dietary } });

  } catch (error: any) {
    console.error("Webhook Processing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
