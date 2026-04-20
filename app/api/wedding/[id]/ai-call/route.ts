import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt, decrypt } from "@/lib/encryption";

// Using Tabbly.io - Specific provider for Indian numbers
const TABBLY_API_KEY = process.env.TABBLY_API_KEY || "";
const TABBLY_ORGANIZATION_ID = parseInt(process.env.TABBLY_ORGANIZATION_ID || "0");
const TABBLY_AGENT_ID = parseInt(process.env.TABBLY_AGENT_ID || "0");
const TABBLY_CALL_FROM_NUMBER = process.env.TABBLY_CALL_FROM_NUMBER || "";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: weddingId } = await params;
    const { guestIds } = await req.json();

    // Use service role client to bypass RLS for server-side operations
    const supabase = createServerSupabaseClient();

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

    // Filter out guests who have already responded — never re-call them
    const callableGuests = guests.filter(g => g.call_status !== "responded");
    const skipped = guests.length - callableGuests.length;

    if (callableGuests.length === 0) {
      return NextResponse.json({
        success: true,
        successful: 0,
        failed: 0,
        skipped,
        message: "All selected guests have already responded."
      });
    }

    const { data: functions } = await supabase
      .from("wedding_functions")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("sort_order");

    let successful = 0;
    let failed = 0;

    for (const guest of callableGuests) {
      const phone = guest.phone?.includes(':') ? decrypt(guest.phone) : guest.phone;
      if (!phone) {
        failed++;
        continue;
      }

      // Debounce: skip if a call was initiated less than 60 seconds ago
      if (guest.call_initiated_at) {
        const lastCall = new Date(guest.call_initiated_at).getTime();
        const now = Date.now();
        if (now - lastCall < 60000) {
          // Too soon — skip this guest silently
          failed++;
          continue;
        }
      }

      // Format phone numbers carefully to E.164 required by Tabbly
      let formattedPhone = String(phone).trim().replace(/[^0-9+]/g, '');
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

Phase 1 - Invitation: Cordially invite them to the upcoming wedding functions (${functionNames}) starting around ${new Date(wedding.wedding_date).toDateString()}. Briefly congratulate them.

Phase 2 - Collect RSVP: After they acknowledge the invitation, politely ask for their RSVP details one by one:
1. Ask if they will be able to attend.
2. If attending, ask how many people (total pax) will be joining.
3. Ask if they have any dietary preferences (Veg, Non-Veg, or Jain).
4. Ask if they will need accommodation or hotel arrangements for the wedding.
If they say they cannot attend (declined), skip questions 2-4 and move to Phase 3.

Phase 3 - Confirmation: Once you have all the details, repeat them back clearly and ask for confirmation. For example:
"Just to confirm — you'll be attending with [X] guests, dietary preference is [preference], and you [will/won't] need accommodation. Is that correct?"
Wait for their confirmation. If they want to correct anything, update accordingly and re-confirm.

Phase 4 - Wrap Up: Thank them and let them know they will also receive a WhatsApp link with detailed RSVP forms and directions. Wish them well.

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
          // Do NOT change call_status on API error
          continue;
        }

        // Call was successfully initiated — set timestamp for debounce only.
        // Actual call_status change happens in sync-call-rsvps after we know the outcome.
        await supabase.from("guests").update({
          call_initiated_at: new Date().toISOString()
        }).eq("id", guest.id);

        successful++;

        // Update communication log
        await supabase.from("communication_logs").insert({
          wedding_id: weddingId,
          guest_id: guest.id,
          type: "call",
          status: "initiated",
          payload: { provider: "tabbly", phone: encrypt(formattedPhone) }
        });

      } catch (e) {
        console.error("Calling error for guest " + guest.id, e);
        failed++;
        // Do NOT change call_status on error
      }
    }

    // Auto-sync: trigger sync at multiple intervals to catch calls at different stages
    // Calls typically take 1-3 minutes, so we sync at 30s, 2min, and 3min
    if (successful > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const syncDelays = [
        { delay: 30000, limit: 5 },   // 30s — catch quick calls
        { delay: 120000, limit: 10 },  // 2min — catch normal calls
        { delay: 180000, limit: 15 },  // 3min — catch longer calls
      ];
      for (const { delay, limit } of syncDelays) {
        setTimeout(async () => {
          try {
            await fetch(`${baseUrl}/api/wedding/${weddingId}/sync-call-rsvps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ limit }),
            });
            console.log(`Auto-sync triggered for wedding ${weddingId} at ${delay / 1000}s (last ${limit} calls)`);
          } catch (e) {
            console.error(`Auto-sync failed at ${delay / 1000}s (non-critical):`, e);
          }
        }, delay);
      }
    }

    return NextResponse.json({ success: true, successful, failed, skipped });

  } catch (error: any) {
    console.error("AI Calling Error:", error);
    
    // Check for network/DNS/internet connectivity issues
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("EAI_AGAIN") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("fetch failed")) {
        return NextResponse.json({ error: "Network error. Please check your internet connection." }, { status: 503 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
