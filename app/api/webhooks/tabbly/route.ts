import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt } from "@/lib/encryption";
import { parseRSVPFromTranscript } from "@/lib/rsvp-parser";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";

const TABBLY_WEBHOOK_SECRET = process.env.TABBLY_WEBHOOK_SECRET || "";

/**
 * Verify webhook signature from Tabbly.
 * Falls back to a shared-secret check if Tabbly doesn't use HMAC signing.
 */
function verifyWebhookSignature(body: string, signatureHeader: string | null): boolean {
  if (!TABBLY_WEBHOOK_SECRET) return false;

  // Option A: HMAC signature verification (preferred)
  if (signatureHeader) {
    const expectedSig = crypto
      .createHmac("sha256", TABBLY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSig)
    );
  }

  // Option B: If Tabbly sends the secret as a query param or header token
  // Adjust this based on Tabbly's actual verification method
  return false;
}

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`webhook:${ip}`, RATE_LIMITS.webhook);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook authenticity
    if (TABBLY_WEBHOOK_SECRET) {
      const signature = req.headers.get("x-tabbly-signature") || req.headers.get("x-webhook-signature");
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.error("[Tabbly Webhook] Invalid or missing signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      // WARN: No webhook secret configured — allowing requests but logging warning
      console.warn("[Tabbly Webhook] TABBLY_WEBHOOK_SECRET not configured — webhook signature verification is disabled. Set it in .env.local for production.");
    }

    const payload = JSON.parse(rawBody);
    console.log("Tabbly Webhook Received:", JSON.stringify(payload, null, 2));

    // Use service role client — webhooks don't have user auth context
    const supabase = createServerSupabaseClient();

    const guestId = payload.custom_identifiers;
    const transcript = payload.transcript || payload.summary || "";
    
    if (!guestId) {
      return NextResponse.json({ error: "No guest identifier found" }, { status: 400 });
    }

    // Approach B: Try reading extracted variables from Tabbly first
    let status = "pending";
    let pax = 0;
    let dietary = null;
    let needsAccommodation = false;

    const dataSource = payload.variables || payload.extracted_data || {};
    
    if (dataSource.rsvp_status) {
        status = String(dataSource.rsvp_status).toLowerCase().trim();
        pax = parseInt(dataSource.guest_count) || (status === "confirmed" ? 1 : 0);
        dietary = dataSource.dietary_preference || null;
        const accVal = String(dataSource.accommodation_needed || "").toLowerCase().trim();
        needsAccommodation = ["yes", "true", "needed", "1"].includes(accVal);
    } else {
        // Approach C: Fallback to local transcript parsing
        const parsed = await parseRSVPFromTranscript(transcript);
        status = parsed.status;
        pax = parsed.total_pax;
        dietary = parsed.dietary_preference;
        needsAccommodation = parsed.needs_accommodation;
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
                        needs_accommodation: status === "confirmed" && needsAccommodation,
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
                        needs_accommodation: status === "confirmed" && needsAccommodation,
                        responded_at: new Date().toISOString()
                    });
                }
            }

            // Log the communication outcome (with wedding_id — TASK-024 fix)
            await supabase.from("communication_logs").insert({
                guest_id: guestId,
                wedding_id: guest.wedding_id,
                type: "call_callback",
                status: payload.status,
                payload: {
                    transcript: encrypt(transcript),
                    parsed: { status, pax, dietary, needsAccommodation }
                }
            });
        }
    }

    return NextResponse.json({ success: true, parsed: { status, pax, dietary } });

  } catch (error: any) {
    console.error("Webhook Processing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
