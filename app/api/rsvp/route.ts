import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt } from "@/lib/encryption";
import { syncGuestWithCRM } from "@/lib/services/crm-sync";
import { randomBytes } from "crypto";

import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`rsvp:${ip}`, RATE_LIMITS.general);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const {
      token,
      weddingId,
      primaryGuest,
      responses, // Record<guestId, Array<{functionId, status}>>
      guestDietaryPreferences, // Record<guestId, string>
      needsAccommodation,
      accommodationCount,
      globalChildrenCount,
      additionalGuests // Array<{name, phone, dietaryPreference}>
    } = body;

    if (!token || !weddingId || !primaryGuest || !responses) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // 1. Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("invite_tokens")
      .select("*")
      .eq("token", token)
      .eq("wedding_id", weddingId)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ success: false, error: "Invalid or consumed invite token" }, { status: 403 });
    }

    const primaryGuestId = primaryGuest.id;
    let effectiveGroupId = primaryGuest.group_id;

    // 2. We need a group if there are additional guests
    if (additionalGuests && additionalGuests.length > 0 && !effectiveGroupId) {
      const { data: newGroup, error: groupError } = await supabase
        .from("guest_groups")
        .insert({
          wedding_id: weddingId,
          name: `${primaryGuest.name.split(" ")[0]}'s Family`
        })
        .select("id")
        .single();

      if (newGroup) {
        effectiveGroupId = newGroup.id;
        // Bind primary guest to this group
        await supabase.from("guests").update({ group_id: effectiveGroupId }).eq("id", primaryGuestId);
      } else {
        console.error("Failed to create guest group:", groupError);
      }
    }

    // 3. Insert additional guests
    const newGuestIds: string[] = [];
    for (const ag of additionalGuests || []) {
      const newGuestToken = randomBytes(16).toString("hex");

      const { data: newGuest, error: insertError } = await supabase
        .from("guests")
        .insert({
          wedding_id: weddingId,
          group_id: effectiveGroupId || null,
          name: ag.name.trim(),
          phone: encrypt(ag.phone.trim()),
          side: primaryGuest.side,
          tags: primaryGuest.tags,
          function_ids: primaryGuest.function_ids,
          invite_token: newGuestToken,
          overall_status: "confirmed",
          imported_via: "manual"
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert additional guest:", insertError);
        continue;
      }

      if (newGuest) {
        newGuestIds.push(newGuest.id);
        // Build responses for the new guest based on primary guest's function IDs
        const primaryResponses = responses[primaryGuestId] || [];
        responses[newGuest.id] = primaryResponses.map((resp: any) => ({
          ...resp,
        }));
        
        // Pass up dietary preference map
        guestDietaryPreferences[newGuest.id] = ag.dietaryPreference || null;
      }
    }

    // 4. Process all RSVPs (Primary + Existing + New)
    const rsvpsToUpsert: any[] = [];
    const guestUpdates = [];

    for (const guestId of Object.keys(responses)) {
      const guestResponses = responses[guestId];
      const isPrimary = guestId === primaryGuestId;

      let allConfirmed = true;
      let allDeclined = true;

      for (const resp of guestResponses) {
        if (resp.status !== "confirmed") allConfirmed = false;
        if (resp.status !== "declined") allDeclined = false;
        
        const dietary_preference = resp.status === "confirmed" ? guestDietaryPreferences[guestId] || null : null;
        // Accommodation: only the primary guest carries the accommodation flag.
        // Additional guests should NOT duplicate the accommodation request.
        const needs_acc = isPrimary && resp.status === "confirmed" && needsAccommodation === true;

        rsvpsToUpsert.push({
          wedding_id: weddingId,
          guest_id: guestId,
          function_id: resp.functionId,
          invite_token: token,
          status: resp.status,
          plus_ones: 0,
          children: isPrimary && resp.status === "confirmed" ? globalChildrenCount : 0,
          total_pax: 1,
          dietary_preference: dietary_preference,
          needs_accommodation: needs_acc,
          responded_at: new Date().toISOString(),
        });
      }

      const overallStatus = allConfirmed ? "confirmed" : (allDeclined ? "declined" : "partial");
      guestUpdates.push(
        supabase.from("guests").update({ overall_status: overallStatus }).eq("id", guestId)
      );

      // CRM Sync
      if (allConfirmed || !allDeclined) {
        syncGuestWithCRM(guestId);
      }
    }

    if (rsvpsToUpsert.length > 0) {
      const { error: rsvpsErr } = await supabase.from("rsvps").upsert(rsvpsToUpsert, { onConflict: "guest_id,function_id" });
      if (rsvpsErr) console.error("RSVPs upsert error:", rsvpsErr);
    }
    
    await Promise.all(guestUpdates);

    // 5. Mark token as used
    // NOTE: If guests can edit their RSVPs later using the same token, you may not want to do this.
    // For now, preserving original logic:
    await supabase.from("invite_tokens").update({ used: true }).eq("token", token);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("POST /api/rsvp error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
