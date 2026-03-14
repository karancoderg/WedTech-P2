import { supabase } from "../supabase";
import { Guest } from "../types";

/**
 * Service to identify pending guests and trigger reminders.
 * In production, this would be a Supabase Edge Function triggered by a Cron Job.
 */
export async function sendRSVPReminders(weddingId: string) {
  try {
    const { data: pendingGuests } = await supabase
      .from("guests")
      .select("*")
      .eq("wedding_id", weddingId)
      .eq("overall_status", "pending");

    if (!pendingGuests || pendingGuests.length === 0) {
      return { success: true, message: "No pending guests to remind." };
    }

    console.log(`[Reminders] Found ${pendingGuests.length} pending guests. Triggering notifications...`);
    
    // Simulating sending WhatsApp/Email reminders
    await new Promise(resolve => setTimeout(resolve, 1500));

    return { 
      success: true, 
      count: pendingGuests.length, 
      message: `Successfully triggered reminders for ${pendingGuests.length} guests.` 
    };
  } catch (error) {
    console.error("[Reminders] Error:", error);
    return { success: false, error };
  }
}
