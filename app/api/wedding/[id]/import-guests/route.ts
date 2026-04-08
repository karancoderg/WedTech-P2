import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";
import type { WeddingFunction } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Helpers ────────────────────────────────────────────────────────────────

// TODO: `deriveFunctionsForSide` is duplicated in:
//   - app/[locale]/(planner)/wedding/[id]/guests/page.tsx (client, for add/edit guest)
//   - here (server, for import)
// Consolidate into a shared lib (e.g. lib/guest-utils.ts) once the client
// version is no longer needed for the import flow.
function deriveFunctionsForSide(
  side: "bride" | "groom" | "both",
  allFunctions: WeddingFunction[]
): string[] {
  if (side === "both") return allFunctions.map((f) => f.id);

  return allFunctions
    .filter((f) => {
      const name = f.name.toLowerCase();
      const isJoint = name.includes("joint") || name.includes("combined");
      if (isJoint) return true;

      if (side === "bride") {
        return (
          !name.includes("groom") &&
          !name.includes("baraat") &&
          !name.includes("sehrabandi")
        );
      } else {
        return (
          !name.includes("bride") &&
          !(name.includes("mehendi") && !name.includes("joint")) &&
          !name.includes("chooda") &&
          !name.includes("bhaat")
        );
      }
    })
    .map((f) => f.id);
}

function generateInviteToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return (
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ImportRow {
  name: string;
  phone: string;
  email?: string;
  side: string;
  tags: string[];
}

interface InvalidRow {
  index: number;
  name: string;
  reason: string;
}

const ALLOWED_SIDES = ["bride", "groom", "both"] as const;
type AllowedSide = (typeof ALLOWED_SIDES)[number];

// ── Pre-validation pass ────────────────────────────────────────────────────
// Validate all rows BEFORE touching the database. This avoids partial inserts
// caused by bad data and gives the client clean per-row error information.

function validateRows(rows: ImportRow[]): {
  valid: (ImportRow & { side: AllowedSide })[];
  invalid: InvalidRow[];
} {
  const valid: (ImportRow & { side: AllowedSide })[] = [];
  const invalid: InvalidRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.name ?? "").trim();
    const phone = String(row.phone ?? "").trim();

    if (!name) {
      invalid.push({ index: i, name: name || "(blank)", reason: "Missing name" });
      continue;
    }
    if (!phone) {
      invalid.push({ index: i, name, reason: "Missing phone number" });
      continue;
    }
    // Loose phone guard — at least 5 digits
    if (!/\d{5,}/.test(phone.replace(/[\s\-+()]/g, ""))) {
      invalid.push({ index: i, name, reason: `Invalid phone: "${phone}"` });
      continue;
    }

    const sideRaw = String(row.side ?? "both").toLowerCase().trim();
    const side: AllowedSide = ALLOWED_SIDES.includes(sideRaw as AllowedSide)
      ? (sideRaw as AllowedSide)
      : "both";

    valid.push({ ...row, name, phone, side });
  }

  return { valid, invalid };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: weddingId } = await params;

  let body: { rows: ImportRow[]; fileName: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rows, fileName } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { imported: 0, failed: 0, invalid: [], errors: ["No rows provided"] },
      { status: 400 }
    );
  }

  // ── Step 1: Pre-validation (before any DB call) ──────────────────────────
  const { valid: validRows, invalid } = validateRows(rows);

  if (validRows.length === 0) {
    return NextResponse.json({
      imported: 0,
      failed: rows.length,
      invalid,
      errors: ["All rows failed validation"],
    });
  }

  // ── Step 2: Fetch wedding functions once ─────────────────────────────────
  const { data: functions, error: funcError } = await supabase
    .from("wedding_functions")
    .select("*")
    .eq("wedding_id", weddingId)
    .order("sort_order");

  if (funcError) {
    return NextResponse.json(
      { error: "Failed to fetch wedding functions" },
      { status: 500 }
    );
  }

  const weddingFunctions: WeddingFunction[] = functions ?? [];
  const importedVia = fileName.endsWith(".csv") ? "csv" : "excel";

  // ── Step 3: Build guest rows (encrypt in-process, no HTTP) ───────────────
  const guestRows = validRows.map((row) => ({
    wedding_id: weddingId,
    name: row.name,
    phone: encrypt(row.phone),                                   // sync, in-process ✅
    email: row.email ? encrypt(row.email) : null,
    side: row.side,
    tags: Array.isArray(row.tags) ? row.tags : [],
    function_ids: deriveFunctionsForSide(row.side, weddingFunctions),
    invite_token: generateInviteToken(),
    overall_status: "pending",
    imported_via: importedVia,
  }));

  // ── Step 4: Batch insert all guests (1 SQL statement) ────────────────────
  const { data: insertedGuests, error: guestInsertError } = await supabase
    .from("guests")
    .insert(guestRows)
    .select("id, invite_token, function_ids");

  if (guestInsertError || !insertedGuests) {
    console.error("Batch guest insert error:", guestInsertError);
    return NextResponse.json(
      {
        error: "Failed to insert guests",
        detail: guestInsertError?.message,
        imported: 0,
        failed: validRows.length,
        invalid,
      },
      { status: 500 }
    );
  }

  // ── Step 5: Batch insert invite_tokens (1 SQL statement) ─────────────────
  // IMPORTANT: If this fails we compensate by deleting the just-inserted
  // guests so no orphaned guest rows exist without a token.
  const tokenRows = insertedGuests.map((g) => ({
    token: g.invite_token,
    wedding_id: weddingId,
    guest_id: g.id,
    function_ids: g.function_ids,
    used: false,
  }));

  const { error: tokenInsertError } = await supabase
    .from("invite_tokens")
    .insert(tokenRows);

  if (tokenInsertError) {
    console.error("Batch token insert failed — compensating delete:", tokenInsertError);

    // Compensating delete: remove the orphaned guests
    const orphanedIds = insertedGuests.map((g) => g.id);
    const { error: cleanupError } = await supabase
      .from("guests")
      .delete()
      .in("id", orphanedIds);

    if (cleanupError) {
      console.error("Cleanup of orphaned guests failed:", cleanupError);
    }

    return NextResponse.json(
      {
        error: "Failed to create invite tokens — import rolled back",
        detail: tokenInsertError.message,
        imported: 0,
        failed: validRows.length,
        invalid,
      },
      { status: 500 }
    );
  }

  // ── Step 6: Return result ─────────────────────────────────────────────────
  return NextResponse.json({
    imported: insertedGuests.length,
    failed: invalid.length,       // rows that failed pre-validation
    invalid,                      // per-row detail for the client to surface
    errors: [],
  });
}
