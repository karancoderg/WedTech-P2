import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("planner_smtp_settings")
    .select("smtp_email, smtp_host, smtp_port, updated_at")
    .eq("planner_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    smtp_email: data.smtp_email,
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    updated_at: data.updated_at,
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { smtp_email, smtp_password, smtp_host, smtp_port } = await request.json();

  if (!smtp_email || !smtp_password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const encryptedPassword = encrypt(smtp_password);
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("planner_smtp_settings")
    .upsert(
      {
        planner_id: userId,
        smtp_email,
        smtp_password_encrypted: encryptedPassword,
        smtp_host: smtp_host || "smtp.gmail.com",
        smtp_port: smtp_port || 587,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "planner_id" }
    );

  if (error) {
    console.error("Failed to save SMTP settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "SMTP settings saved successfully" });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("planner_smtp_settings")
    .delete()
    .eq("planner_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete settings" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "SMTP settings removed" });
}
