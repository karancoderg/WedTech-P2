import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured on server" }, { status: 500 });
    }

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

    // Calculate maximum guests to return
    const cappedGuests = unassignedGuests.slice(0, targetSeatingCount);

    const prompt = `
      You are an expert wedding seating planner. Your job is to assign guests to tables.
      
      You must seat EXACTLY ${cappedGuests.length} guests from the provided Unassigned Guests list.
      DO NOT assign any more guests than that.
      
      RULES:
      1. Fill existing tables first. DO NOT assign more guests to an existing table than its remaining capacity.
      2. If all existing tables are full, you MUST create new tables. Give them realistic capacities (8-12 seats), round or rectangular shapes, and standard names (e.g., "Table 5").
      3. Group guests intelligently:
         - Keep guests from the same side (bride/groom) together where possible.
         - Look at guests' names. If they share a last name or appear to be a family/couple, seat them together.
      
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for deterministic/logical seating
      }
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    const aiResult = JSON.parse(response.text);

    // Now we must save this to Supabase
    const supabase = await createServerSupabaseClient();
    
    // 1. Insert any new tables
    interface NewTable { name: string; capacity: number; shape: string; assignedGuestIds: string[]; id?: string; }
    const newlyCreatedTables: NewTable[] = [];
    
    if (aiResult.newTables && aiResult.newTables.length > 0) {
      for (const newTable of aiResult.newTables) {
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
         
         // Add the real DB id to our local object
         newTable.id = data.id;
         newlyCreatedTables.push(newTable);
      }
    }

    // 2. Prepare all guest_seating insert records
    const seatingInserts: { guest_id: string, table_id: string }[] = [];
    
    // Add assignments for existing tables
    if (aiResult.assignments) {
      for (const assignment of aiResult.assignments) {
        seatingInserts.push({
          guest_id: assignment.guestId,
          table_id: assignment.tableId
        });
      }
    }

    // Add assignments for newly created tables
    for (const newTable of newlyCreatedTables) {
      if (newTable.id && newTable.assignedGuestIds) {
        for (const guestId of newTable.assignedGuestIds) {
           seatingInserts.push({
             guest_id: guestId,
             table_id: newTable.id
           });
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
