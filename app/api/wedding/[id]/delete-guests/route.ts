import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * DELETE /api/wedding/[id]/delete-guests
 * Body: { guestIds: string[] }
 *
 * Deletes the specified guests. All related rows (invite_tokens, rsvps,
 * guest_seating, communication_logs) are removed automatically via the
 * ON DELETE CASCADE FK constraints added in migration
 * `add_cascade_delete_on_guest_related_tables`.
 *
 * After deletion, re-calculates the denormalised counters on `weddings`
 * (total_guests, total_confirmed, total_pending, total_declined, total_pax)
 * from the remaining source-of-truth rows so they never drift.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: weddingId } = await params;

  let body: { guestIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { guestIds } = body;

  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: "No guest IDs provided" }, { status: 400 });
  }

  // ── Step 1: Delete guests ────────────────────────────────────────────────
  // CASCADE automatically removes: invite_tokens, rsvps, guest_seating,
  // communication_logs rows where guest_id matches.
  const { error: deleteError, count } = await supabase
    .from("guests")
    .delete({ count: "exact" })
    .in("id", guestIds)
    .eq("wedding_id", weddingId); // safety: only delete guests belonging to this wedding

  if (deleteError) {
    console.error("Guest delete error:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete guests", detail: deleteError.message },
      { status: 500 }
    );
  }

  // ── Step 2: Recalculate denormalised wedding counters ────────────────────
  // Count from source-of-truth (remaining guests) rather than doing arithmetic
  // on the old values — guarantees counters are always accurate regardless of
  // prior drift.
  const [guestCountRes, confirmedRes, declinedRes, pendingRes, paxRes] = await Promise.all([
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("overall_status", "confirmed"),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("overall_status", "declined"),
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("overall_status", "pending"),
    // total_pax = sum of confirmed RSVP total_pax
    supabase
      .from("rsvps")
      .select("total_pax")
      .eq("wedding_id", weddingId)
      .eq("status", "confirmed"),
  ]);

  const totalPax = (paxRes.data ?? []).reduce(
    (sum: number, r: { total_pax: number }) => sum + (r.total_pax ?? 0),
    0
  );

  const { error: counterUpdateError } = await supabase
    .from("weddings")
    .update({
      total_guests:    guestCountRes.count ?? 0,
      total_confirmed: confirmedRes.count  ?? 0,
      total_declined:  declinedRes.count   ?? 0,
      total_pending:   pendingRes.count    ?? 0,
      total_pax:       totalPax,
    })
    .eq("id", weddingId);

  if (counterUpdateError) {
    // Non-fatal: guests are deleted, counters just need a refresh
    console.error("Counter recalculation failed:", counterUpdateError);
  }

  return NextResponse.json({ deleted: count ?? guestIds.length });
}
