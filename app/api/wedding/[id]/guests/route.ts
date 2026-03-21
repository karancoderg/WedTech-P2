import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const decryptedGuests = (data || []).map((guest) => ({
    ...guest,
    phone: guest.phone?.includes(":") ? decrypt(guest.phone) : guest.phone,
    email: guest.email?.includes(":") ? decrypt(guest.email) : guest.email,
  }));

  return NextResponse.json(decryptedGuests);
}
