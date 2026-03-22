import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: weddingId } = await params;

  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("wedding_id", weddingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Decrypt guest data server-side where ENCRYPTION_KEY is available
  const decryptedGuests = (data || []).map((guest) => {
    let phone = guest.phone;
    let email = guest.email;

    if (phone?.includes(":")) {
      try {
        phone = decrypt(phone);
      } catch (err) {
        console.error(`Failed to decrypt phone for guest ${guest.id}:`, err);
        phone = "••••••••••"; // Masked fallback
      }
    }

    if (email?.includes(":")) {
      try {
        email = decrypt(email);
      } catch (err) {
        console.error(`Failed to decrypt email for guest ${guest.id}:`, err);
        email = "••••@••••";
      }
    }

    return { ...guest, phone, email };
  });

  return NextResponse.json(decryptedGuests);
}
