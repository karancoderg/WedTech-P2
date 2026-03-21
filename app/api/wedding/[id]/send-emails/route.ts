import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { EmailService, SmtpConfig } from "@/lib/email-service";
import { Guest, Wedding, WeddingFunction } from "@/lib/types";
import { z } from "zod";
import dns from "dns";
import { promisify } from "util";
import { encrypt, decrypt } from "@/lib/encryption";

const resolveMx = promisify(dns.resolveMx);
const emailSchema = z.string().email();

const ALLOWED_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'yahoo.co.in',
  'outlook.in',
  'icloud.com'
];

const DOMAIN_TYPOS: Record<string, string[]> = {
  'gmail.com': ['gmal.com', 'gamil.com', 'gmial.com', 'gnail.com'],
  'yahoo.com': ['yaaho.com', 'yaho.com', 'yhaoo.com'],
  'hotmail.com': ['hotmial.com', 'hotamail.com', 'htmail.com', 'hotlook.com'],
  'outlook.com': ['outlok.com', 'outllok.com', 'autlook.com'],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log(">>> Bulk Email API Triggered");
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: weddingId } = await params;
  const supabase = createServerSupabaseClient();
  const { guestIds } = await request.json();

  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: "No guests selected" }, { status: 400 });
  }

  try {
    // 1. Authorization: Verify planner owns the wedding
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", weddingId)
      .eq("planner_id", userId)
      .single();

    if (weddingError || !wedding) {
      return NextResponse.json({ error: "Wedding not found or unauthorized" }, { status: 404 });
    }

    // 1b. Fetch planner's SMTP settings (if configured)
    let smtpConfig: SmtpConfig | undefined;
    const { data: smtpSettings } = await supabase
      .from("planner_smtp_settings")
      .select("*")
      .eq("planner_id", userId)
      .single();

    if (smtpSettings) {
      smtpConfig = {
        host: smtpSettings.smtp_host,
        port: smtpSettings.smtp_port,
        user: smtpSettings.smtp_email?.includes(':') ? decrypt(smtpSettings.smtp_email) : smtpSettings.smtp_email,
        pass: decrypt(smtpSettings.smtp_password_encrypted),
      };
    }

    // 2. Data Fetching
    const [guestsRes, functionsRes] = await Promise.all([
      supabase.from("guests").select("*").in("id", guestIds),
      supabase.from("wedding_functions").select("*").eq("wedding_id", weddingId).order("sort_order"),
    ]);

    const guests: Guest[] = guestsRes.data || [];
    const functions: WeddingFunction[] = functionsRes.data || [];

    if (guests.length === 0) {
      return NextResponse.json({ error: "No valid guests found" }, { status: 404 });
    }

    // 3. Batch Processing
    const BATCH_SIZE = 10;
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { guestId: string; name: string; error: string }[],
    };

    // Mark as pending initially
    await supabase
      .from("guests")
      .update({ invite_status: "pending" })
      .in("id", guestIds);

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (guest) => {
        const guestEmail = guest.email?.includes(':') ? decrypt(guest.email) : guest.email;
        try {
          if (!guestEmail) {
            throw new Error("Email address missing");
          }

          // Syntax validation
          const validation = emailSchema.safeParse(guest.email);
          if (!validation.success) {
            throw new Error("Invalid email format");
          }

          // Domain/MX record validation
          const domain = guestEmail.toLowerCase().split("@")[1];

          // Typo Detection
          for (const [valid, typos] of Object.entries(DOMAIN_TYPOS)) {
            if (typos.includes(domain)) {
              throw new Error(`Likely typo detected: Did you mean ${valid}?`);
            }
          }

          // Whitelist Enforcement
          if (!ALLOWED_DOMAINS.includes(domain)) {
            throw new Error(`Sending to ${domain} is not supported. Use Gmail, Outlook, Yahoo, or Hotmail.`);
          }

          try {
            const mx = await resolveMx(domain);
            if (!mx || mx.length === 0) {
              throw new Error("No mail server found for this domain");
            }
          } catch (e) {
            throw new Error(`Domain verification failed: ${domain}`);
          }

          await EmailService.sendInvitation(guest, wedding as unknown as Wedding, functions, smtpConfig);
          
          // Update status & log success
          await Promise.all([
            supabase.from("guests").update({ 
              invite_status: "sent", 
              invite_sent_at: new Date().toISOString(),
              invite_error: null 
            }).eq("id", guest.id),
            supabase.from("communication_logs").insert({
              wedding_id: weddingId,
              guest_id: guest.id,
              status: "sent",
              payload: { type: "invitation_email", to: encrypt(guestEmail) }
            })
          ]);

          results.successful++;
        } catch (error: any) {
          console.error(`Failed to send email to ${guest.name}:`, error);
          const errorMessage = error.message || "Unknown error";
          
          // Update status & log failure
          await Promise.all([
            supabase.from("guests").update({ 
              invite_status: "failed", 
              invite_error: errorMessage 
            }).eq("id", guest.id),
            supabase.from("communication_logs").insert({
              wedding_id: weddingId,
              guest_id: guest.id,
              status: "failed",
              payload: { type: "invitation_email", to: encrypt(guestEmail), error: errorMessage }
            })
          ]);

          results.failed++;
          results.errors.push({ guestId: guest.id, name: guest.name, error: errorMessage });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    return NextResponse.json({
      message: "Bulk email process completed",
      ...results
    });

  } catch (error: any) {
    console.error("Bulk email API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
