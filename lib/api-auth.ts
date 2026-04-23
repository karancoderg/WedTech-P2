import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Shared auth + ownership guard for wedding-scoped API routes.
 *
 * 1. Verifies Clerk authentication (returns 401 if missing)
 * 2. Verifies the authenticated user owns the wedding (returns 404 if not)
 *
 * Returns { userId, supabase, wedding } on success, or a NextResponse error.
 */
export async function requireWeddingOwner(weddingId: string) {
  const { userId } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabase = createServerSupabaseClient();

  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", weddingId)
    .eq("planner_id", userId)
    .single();

  if (weddingError || !wedding) {
    return {
      error: NextResponse.json({ error: "Wedding not found" }, { status: 404 }),
    };
  }

  return { userId, supabase, wedding };
}
