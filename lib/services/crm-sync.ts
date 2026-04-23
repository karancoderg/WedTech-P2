import { supabase } from "../supabase";
import { Guest, RSVP } from "../types";

/**
 * Service to sync RSVP data with an external CRM (Product 1).
 * In a real-world scenario, this would call an API or trigger a webhook.
 */
export async function syncGuestWithCRM(guestId: string) {
  try {
    const { data: guest } = await supabase
      .from("guests")
      .select("*, rsvps(*)")
      .eq("id", guestId)
      .single();

    if (!guest) return { success: false, error: "Guest not found" };

    // Simulating an API call to the Wedding CRM (Product 1)
    console.log(`[CRM Sync] Pushing guest ${guest.name} (ID: ${guestId}) to CRM...`);
    
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // Update guest's local metadata to indicate sync status
    // (Assuming we might add a last_synced_at column or just mock the success)
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("[CRM Sync] Error:", error);
    return { success: false, error };
  }
}

/**
 * Bulk sync for all confirmed guests
 */
export async function bulkSyncWithCRM(weddingId: string) {
  const { data: guests } = await supabase
    .from("guests")
    .select("id")
    .eq("wedding_id", weddingId)
    .eq("overall_status", "confirmed");

  if (!guests) return { count: 0 };

  let successCount = 0;
  for (const guest of guests) {
    const res = await syncGuestWithCRM(guest.id);
    if (res.success) successCount++;
  }

  return { total: guests.length, synced: successCount };
}
