import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Safely parse JSON — never throws. Handles markdown wrappers, extra text. */
function safeJsonParse(text: string): any | null {
    try { return JSON.parse(text); } catch {}
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
    return null;
}

/** Fetch with retry on 429 / 5xx (max 2 attempts) */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 1): Promise<Response> {
    let lastResponse: Response | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        lastResponse = await fetch(url, options);
        if (lastResponse.ok || (lastResponse.status !== 429 && lastResponse.status < 500)) {
            return lastResponse;
        }
        if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 + attempt * 1000));
        }
    }
    return lastResponse!;
}

interface Assignment { guestId: string; tableId: string }
interface NewTableDef { name: string; capacity: number; shape: string; assignedGuestIds: string[] }
interface SeatingResult { assignments: Assignment[]; newTables: NewTableDef[] }

/** Validate and sanitize AI seating output. Enforces capacity, deduplicates, removes invalid entries. */
function validateSeatingResult(
    raw: any,
    validTableIds: Set<string>,
    tableCapacityMap: Map<string, number>, // tableId → remaining capacity
    validGuestIds: Set<string>
): SeatingResult | null {
    if (!raw || typeof raw !== 'object') return null;

    const assignments: Assignment[] = [];
    const newTables: NewTableDef[] = [];
    const assignedGuests = new Set<string>(); // dedup: no guest assigned twice
    const tableUsed = new Map<string, number>(); // track how many we assign per table

    // 1. Validate assignments to existing tables
    if (Array.isArray(raw.assignments)) {
        for (const a of raw.assignments) {
            if (!a || typeof a.guestId !== 'string' || typeof a.tableId !== 'string') continue;
            if (!validGuestIds.has(a.guestId)) continue;      // unknown guest
            if (!validTableIds.has(a.tableId)) continue;       // unknown table
            if (assignedGuests.has(a.guestId)) continue;       // already assigned

            // Capacity check
            const remaining = (tableCapacityMap.get(a.tableId) || 0) - (tableUsed.get(a.tableId) || 0);
            if (remaining <= 0) continue; // table full

            assignments.push({ guestId: a.guestId, tableId: a.tableId });
            assignedGuests.add(a.guestId);
            tableUsed.set(a.tableId, (tableUsed.get(a.tableId) || 0) + 1);
        }
    }

    // 2. Validate new tables
    if (Array.isArray(raw.newTables)) {
        for (const nt of raw.newTables) {
            if (!nt || typeof nt.name !== 'string') continue;
            const capacity = Math.max(2, Math.min(20, parseInt(nt.capacity) || 8));
            const shape = (nt.shape === 'rectangular') ? 'rectangular' : 'round';
            const guestIds: string[] = [];

            if (Array.isArray(nt.assignedGuestIds)) {
                for (const gId of nt.assignedGuestIds) {
                    if (typeof gId !== 'string') continue;
                    if (!validGuestIds.has(gId)) continue;
                    if (assignedGuests.has(gId)) continue;
                    if (guestIds.length >= capacity) break; // respect capacity
                    guestIds.push(gId);
                    assignedGuests.add(gId);
                }
            }

            if (guestIds.length > 0) {
                newTables.push({ name: nt.name, capacity, shape, assignedGuestIds: guestIds });
            }
        }
    }

    if (assignments.length === 0 && newTables.length === 0) return null;
    return { assignments, newTables };
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: weddingId } = await params;
    const body = await request.json();
    const { tables, unassignedGuests, targetSeatingCount, functionId } = body;

    if (!tables || !unassignedGuests || typeof targetSeatingCount !== 'number') {
      return NextResponse.json({ error: "Missing required tracking data" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "No AI API key configured (Gemini or Groq)" }, { status: 500 });
    }

    // Build validation maps from input data
    const validTableIds = new Set<string>(tables.map((t: any) => t.id));
    const tableCapacityMap = new Map<string, number>();
    for (const t of tables) {
        const remaining = t.capacity - (t.assigned_guests?.length || 0);
        tableCapacityMap.set(t.id, Math.max(0, remaining));
    }

    const cappedGuests = unassignedGuests.slice(0, targetSeatingCount);
    const validGuestIds = new Set<string>(cappedGuests.map((g: any) => g.id));

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        assignments: {
          type: Type.ARRAY,
          description: "Assignments of guests to EXISTING tables. Must not exceed table capacity.",
          items: {
            type: Type.OBJECT,
            properties: {
              guestId: { type: Type.STRING },
              tableId: { type: Type.STRING }
            },
            required: ["guestId", "tableId"]
          }
        },
        newTables: {
          type: Type.ARRAY,
          description: "New tables created to accommodate guests that couldn't fit in existing tables. Only create these if necessary.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Logical name like 'Table 5' or 'Family Table'" },
              capacity: { type: Type.INTEGER, description: "Total seats (e.g. 8-10)" },
              shape: { type: Type.STRING, description: "Must be 'round' or 'rectangular'" },
              assignedGuestIds: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of guest IDs sitting at this newly created table" 
              }
            },
            required: ["name", "capacity", "shape", "assignedGuestIds"]
          }
        }
      },
      required: ["assignments", "newTables"]
    };

    const prompt = `
      You are an expert wedding seating planner. Your job is to assign guests to tables.
      
      You must seat EXACTLY ${cappedGuests.length} guests from the provided Unassigned Guests list.
      DO NOT assign any more guests than that.
      
      CRITICAL RULES:
      1. Fill existing tables first. NEVER assign more guests to a table than its emptySeatsRemaining.
      2. If all existing tables are full, create new tables with 8-12 seat capacity.
      3. NEVER assign the same guest (guestId) to multiple tables.
      4. Group guests intelligently:
         - Keep guests from the same side (bride/groom) together where possible.
         - If they share a last name or appear to be a family/couple, seat them together.
      5. Every guestId in your response MUST come from the GUESTS TO SEAT list below.
      6. Every tableId in assignments MUST come from the EXISTING TABLES list below.
      
      CURRENT EXISTING TABLES:
      ${JSON.stringify(tables.map((t: any) => ({ 
        id: t.id, 
        name: t.name, 
        maxCapacity: t.capacity, 
        currentlySeatedCount: t.assigned_guests?.length || 0,
        emptySeatsRemaining: t.capacity - (t.assigned_guests?.length || 0)
      })), null, 2)}
      
      GUESTS TO SEAT:
      ${JSON.stringify(cappedGuests.map((g: any) => ({
        id: g.id,
        name: g.name,
        side: g.side
      })), null, 2)}
    `;

    let validatedResult: SeatingResult | null = null;

    // Try 1: Gemini 2.5 Flash
    if (ai && process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.1,
          }
        });

        if (response.text) {
          const parsed = safeJsonParse(response.text);
          if (parsed) {
            validatedResult = validateSeatingResult(parsed, validTableIds, tableCapacityMap, validGuestIds);
          }
        }
      } catch (geminiErr) {
        console.error("Gemini seating error, will try Groq fallback:", geminiErr);
      }
    }

    // Try 2: Groq Mixtral 8x7B fallback
    if (!validatedResult && process.env.GROQ_API_KEY) {
      try {
        console.log("Using Groq Mixtral 8x7B for seating plan...");

        const groqRes = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'mixtral-8x7b-32768',
            messages: [
              { role: 'system', content: 'You are an expert wedding seating planner. Respond with valid JSON only containing two keys: "assignments" (array of {guestId, tableId}) and "newTables" (array of {name, capacity, shape, assignedGuestIds}). No markdown or explanations.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            const parsed = safeJsonParse(text);
            if (parsed) {
              validatedResult = validateSeatingResult(parsed, validTableIds, tableCapacityMap, validGuestIds);
            }
          }
        } else {
          console.error("Groq seating API error:", groqRes.status);
        }
      } catch (groqErr) {
        console.error("Groq seating error:", groqErr);
      }
    }

    if (!validatedResult) {
      return NextResponse.json({ error: "AI could not generate a valid seating plan. Please try again." }, { status: 422 });
    }

    // ─── Save to Supabase ──────────────────────────────────────────────
    const supabase = createServerSupabaseClient();
    
    // 1. Insert any new tables
    interface NewTable extends NewTableDef { id?: string }
    const newlyCreatedTables: NewTable[] = [];
    
    for (const newTable of validatedResult.newTables) {
       const { data, error } = await supabase
         .from("seating_tables")
         .insert({
           wedding_id: weddingId,
           function_id: functionId,
           name: newTable.name,
           capacity: newTable.capacity,
           shape: newTable.shape
         })
         .select()
         .single();
         
       if (error) {
         console.error("Failed to insert new table:", error);
         continue; 
       }
       
       newlyCreatedTables.push({ ...newTable, id: data.id });
    }

    // 2. Collect all seating inserts with final dedup guard
    const seatingInserts: { guest_id: string; table_id: string }[] = [];
    const finalAssignedGuests = new Set<string>();
    
    for (const a of validatedResult.assignments) {
      if (!finalAssignedGuests.has(a.guestId)) {
        seatingInserts.push({ guest_id: a.guestId, table_id: a.tableId });
        finalAssignedGuests.add(a.guestId);
      }
    }

    for (const newTable of newlyCreatedTables) {
      if (newTable.id) {
        for (const guestId of newTable.assignedGuestIds) {
          if (!finalAssignedGuests.has(guestId)) {
            seatingInserts.push({ guest_id: guestId, table_id: newTable.id });
            finalAssignedGuests.add(guestId);
          }
        }
      }
    }

    // 3. Batch insert into guest_seating
    if (seatingInserts.length > 0) {
      const { error } = await supabase
        .from("guest_seating")
        .insert(seatingInserts);
        
      if (error) {
        console.error("Failed to batch insert guest seating:", error);
        return NextResponse.json({ error: "Failed to save assignments to database" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      seatedCount: seatingInserts.length,
      newTablesCreated: newlyCreatedTables.length
    });

  } catch (error) {
    console.error("AI Seating Error:", error);
    return NextResponse.json(
      { error: "Failed to generate seating plan" },
      { status: 500 }
    );
  }
}
