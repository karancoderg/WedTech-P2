import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Using Tabbly.io - Specific provider for Indian numbers
const TABBLY_API_KEY = process.env.TABBLY_API_KEY || "";
const TABBLY_ORGANIZATION_ID = parseInt(process.env.TABBLY_ORGANIZATION_ID || "0");
const TABBLY_AGENT_ID = parseInt(process.env.TABBLY_AGENT_ID || "0");
const TABBLY_CALL_FROM_NUMBER = process.env.TABBLY_CALL_FROM_NUMBER || "";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: weddingId } = await params;
    const { guestIds } = await req.json();

    if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json({ error: "Invalid guest IDs" }, { status: 400 });
    }

    if (!TABBLY_API_KEY || !TABBLY_ORGANIZATION_ID || !TABBLY_AGENT_ID || !TABBLY_CALL_FROM_NUMBER) {
        console.warn("Tabbly API credentials missing in .env.local.");
        return NextResponse.json({ error: "AI Calling Provider Credentials Missing" }, { status: 500 });
    }

    // Fetch wedding details
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", weddingId)
      .single();

    if (weddingError || !wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    // Fetch guests
    const { data: guests, error: guestsError } = await supabase
      .from("guests")
      .select("*")
      .in("id", guestIds);

    if (guestsError || !guests) {
      return NextResponse.json({ error: "No guests found" }, { status: 404 });
    }

    const { data: functions } = await supabase
      .from("wedding_functions")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sort_order");

    let successful = 0;
    let failed = 0;

    for (const guest of guests) {
      if (!guest.phone) {
        failed++;
        continue;
      }

      // Format phone numbers carefully to E.164 required by Tabbly
      let formattedPhone = String(guest.phone).trim().replace(/[^0-9+]/g, '');
      if (!formattedPhone.startsWith('+')) {
         if (formattedPhone.length === 10) {
            formattedPhone = "+91" + formattedPhone; 
         } else {
            formattedPhone = "+" + formattedPhone;
         }
      }

      // Compute wedding functions this guest is invited to
      const functionNames = (functions || [])
        .filter(f => guest.function_ids.includes(f.id))
        .map(f => f.name)
        .join(" and ");

      const customInstruction = `You are a warm, polite Indian wedding invitation assistant calling on behalf of ${wedding.bride_name} and ${wedding.groom_name}.
You are speaking to ${guest.name}. 

Phase 1: Cordially invite them to the upcoming wedding functions (${functionNames}) starting around ${new Date(wedding.wedding_date).toDateString()}. Briefly congratulate them.

Phase 2: After they acknowledge the invitation, politely ask for their RSVP details:
1. Ask if they will be able to attend.
2. If attending, ask how many people (total pax) will be joining.
3. Ask if they have any dietary preferences (Veg, Non-Veg, or Jain).

Phase 3: Wrap up by letting them know they will also receive a WhatsApp link with detailed RSVP forms and directions. 

Keep the conversation natural, short, and respectful. Wait for their responses carefully. Do not sound like a robot.`;

      // Make the actual call via Tabbly.io
      try {
        const tabblyReq = await fetch('https://www.tabbly.io/dashboard/agents/endpoints/trigger-call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: TABBLY_API_KEY,
                organization_id: TABBLY_ORGANIZATION_ID,
                use_agent_id: TABBLY_AGENT_ID,
                call_from: TABBLY_CALL_FROM_NUMBER,
                called_to: formattedPhone,
                custom_first_line: `Hello, am I speaking with ${guest.name}?`,
                custom_identifiers: guest.id,
                custom_instruction: customInstruction,
                called_by_account: "API"
            })
        });

        if (!tabblyReq.ok) {
           console.error("Tabbly AI Error:", await tabblyReq.text());
           failed++;
           continue;
        }

        successful++;
        
         // Update communication log
         await supabase.from("communication_logs").insert({
            wedding_id: weddingId,
            guest_id: guest.id,
            type: "call",
            status: "initiated",
            payload: { provider: "tabbly", phone: formattedPhone }
         });

      } catch (e) {
         console.error("Calling error for guest " + guest.id, e);
         failed++;
      }
    }

    return NextResponse.json({ success: true, successful, failed });

  } catch (error: any) {
    console.error("AI Calling Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
