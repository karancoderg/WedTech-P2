import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import * as XLSX from "xlsx";
import { auth } from "@clerk/nextjs/server";
import { decrypt } from "@/lib/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: weddingId } = await params;
  const supabase = createServerSupabaseClient();

  try {
    // Fetch wedding, functions, guests, and RSVPs
    const [weddingRes, funcRes, guestRes, rsvpRes] = await Promise.all([
      supabase.from("weddings").select("*").eq("id", weddingId).eq("planner_id", userId).single(),
      supabase
        .from("wedding_functions")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("sort_order"),
      supabase
        .from("guests")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("name"),
      supabase.from("rsvps").select("*").eq("wedding_id", weddingId),
    ]);

    if (!weddingRes.data) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    const wedding = weddingRes.data;
    const functions = funcRes.data || [];
    const guests = guestRes.data || [];
    const rsvps = rsvpRes.data || [];

    // Build export data
    const rows = guests.map((guest) => {
      const guestRsvps = rsvps.filter((r) => r.guest_id === guest.id);
      const row: Record<string, string | number | boolean> = {
        Name: guest.name,
        Phone: (() => {
          if (!guest.phone) return "";
          if (guest.phone.includes(":")) {
            try { return decrypt(guest.phone); } catch { return "***"; }
          }
          return guest.phone;
        })(),
        Email: (() => {
          if (!guest.email) return "";
          if (guest.email.includes(":")) {
            try { return decrypt(guest.email); } catch { return "***"; }
          }
          return guest.email;
        })(),
        Side: guest.side,
        Tags: (guest.tags || []).join(", "),
        "Overall Status": guest.overall_status,
        "Invite Sent": guest.invite_sent_at ? "Yes" : "No",
      };

      // Add per-function RSVP data
      for (const func of functions) {
        const rsvp = guestRsvps.find((r) => r.function_id === func.id);
        row[`${func.name} - Status`] = rsvp?.status || "not invited";
        row[`${func.name} - PAX`] = rsvp?.total_pax || 0;
        row[`${func.name} - Dietary`] = rsvp?.dietary_preference || "";
        row[`${func.name} - Accommodation`] = rsvp?.needs_accommodation
          ? "Yes"
          : "No";
        row[`${func.name} - Checked In`] = rsvp?.checked_in ? "Yes" : "No";
      }

      return row;
    });

    // Generate Excel workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      wedding.wedding_name.slice(0, 31)
    );

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Return as downloadable file
    const safeName = wedding.wedding_name.replace(/[^a-zA-Z0-9_\- ]/g, "_").slice(0, 50);
    const filename = `${safeName.replace(/\s/g, "_")}_GuestReport.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
