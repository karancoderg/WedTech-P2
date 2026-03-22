import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseRSVPFromTranscript } from "@/lib/rsvp-parser";

const TABBLY_API_KEY = process.env.TABBLY_API_KEY || "";
const TABBLY_ORGANIZATION_ID = process.env.TABBLY_ORGANIZATION_ID || "";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: weddingId } = await params;

    if (!TABBLY_API_KEY || !TABBLY_ORGANIZATION_ID) {
      return NextResponse.json({ error: "Tabbly credentials missing" }, { status: 500 });
    }

    // Fetch latest 100 call logs from Tabbly
    const response = await fetch(`https://www.tabbly.io/dashboard/agents/endpoints/call-logs-v2?api_key=${TABBLY_API_KEY}&organization_id=${TABBLY_ORGANIZATION_ID}&limit=100`);
    
    if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch Tabbly logs" }, { status: 502 });
    }

    const result = await response.json();
    if (result.status !== "success") {
        return NextResponse.json({ error: result.message || "Unknown Tabbly error" }, { status: 502 });
    }

    const logs = result.data || [];
    let updatedCount = 0;

    const transcriptsToParse: { id: string; transcript: string }[] = [];
    const structuredDataMap = new Map<string, any>();

    // Pass 1: Collect what needs LLM vs what has native structured data
    for (const log of logs) {
        const guestId = log.custom_identifiers; 
        const transcript = log.call_transcript || log.call_summary || "";

        if (!guestId) continue;

        const dataSource = log.variables || log.extracted_data || {};
        structuredDataMap.set(guestId, { log }); // start with log and pending status

        if (dataSource.rsvp_status) {
            let status = String(dataSource.rsvp_status).toLowerCase().trim();
            let pax = parseInt(dataSource.guest_count) || (status === "confirmed" ? 1 : 0);
            let dietary = dataSource.dietary_preference || null;
            const accVal = String(dataSource.accommodation_needed || "").toLowerCase().trim();
            let needsAccommodation = ["yes", "true", "needed", "1"].includes(accVal);
            
            Object.assign(structuredDataMap.get(guestId), { status, pax, dietary, needsAccommodation });
        } else if (transcript) {
            transcriptsToParse.push({ id: guestId, transcript });
        }
    }

    // Pass 2: Batch LLM Processing using Gemini 2.5 Flash
    if (transcriptsToParse.length > 0 && process.env.GEMINI_API_KEY) {
        // Chunk into groups of 25 to ensure safety and avoid context output limits
        for (let i = 0; i < transcriptsToParse.length; i += 25) {
            const chunk = transcriptsToParse.slice(i, i + 25);
            
            const prompt = `You are an expert RSVP extractor. I will provide a JSON array of call transcripts.
Extract the RSVP details for each guest. 
Return exactly a valid JSON array of objects with this exact structure:
[
  {
    "id": "guest string id from input",
    "status": "confirmed" | "declined" | "pending",
    "guestCount": number (total pax, 0 if declined),
    "dietaryPreference": {"veg": number, "nonveg": number, "jain": number} (if all same, just set the matching key. e.g. {"nonveg": 3, "veg": 0, "jain": 0}),
    "accommodationNeeded": boolean,
    "accommodationCount": number (if accommodationNeeded is true, the number of persons needing accommodation, otherwise 0)
  }
]

Transcripts to process:
${JSON.stringify(chunk)}
`;

            try {
                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });
                
                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const parsedArray = JSON.parse(text);
                        for (const parsed of parsedArray) {
                            const guestData = structuredDataMap.get(parsed.id);
                            if (guestData) {
                                let dietaryToSave = parsed.dietaryPreference;
                                if (typeof dietaryToSave === 'object' && dietaryToSave !== null) {
                                    dietaryToSave = JSON.stringify({ ...dietaryToSave, _isGeminiParams: true, accommodationCount: parsed.accommodationCount || 0 });
                                }
                                Object.assign(guestData, {
                                    status: parsed.status,
                                    pax: parsed.guestCount ?? parsed.pax,
                                    dietary: dietaryToSave ?? parsed.dietary,
                                    needsAccommodation: parsed.accommodationNeeded ?? parsed.needsAccommodation,
                                    accommodationCount: parsed.accommodationCount || 0
                                });
                            }
                        }
                    }
                } else {
                    console.error("Gemini API Error:", await geminiRes.text());
                }
            } catch (err) {
                console.error("Batch parse error with Gemini:", err);
            }
        }
    } 
    
    // Pass 2B: Fallback for any unparsed transcripts (either failed LLM or no API key)
    for (const item of transcriptsToParse) {
        const guestData = structuredDataMap.get(item.id);
        if (guestData && !guestData.status) {
            const parsed = await parseRSVPFromTranscript(item.transcript);
            Object.assign(guestData, {
                status: parsed.status,
                pax: parsed.total_pax,
                dietary: parsed.dietary_preference,
                needsAccommodation: parsed.needs_accommodation
            });
        }
    }

    // Pass 3: Database Update Logic
    for (const [guestId, data] of structuredDataMap.entries()) {
        const { status, pax, dietary, needsAccommodation, log } = data;

        if (!status || status === "pending") continue;

        // 1. Update Guest status
        const { error: guestUpdateError } = await supabase.from("guests")
            .update({ overall_status: status })
            .eq("id", guestId)
            .eq("wedding_id", weddingId);

        if (guestUpdateError) continue;

        // 2. Insert/Update RSVPs
        const { data: guest } = await supabase.from("guests").select("function_ids").eq("id", guestId).single();

        if (guest && guest.function_ids) {
            for (const functionId of guest.function_ids) {
                const { data: existingRSVP } = await supabase
                    .from("rsvps")
                    .select("id")
                    .eq("guest_id", guestId)
                    .eq("function_id", functionId)
                    .single();

                if (existingRSVP) {
                    await supabase.from("rsvps").update({
                        status: status,
                        total_pax: status === "confirmed" ? pax : 0,
                        dietary_preference: dietary,
                        needs_accommodation: status === "confirmed" && needsAccommodation,
                        responded_at: log.called_time 
                    }).eq("id", existingRSVP.id);
                } else {
                    await supabase.from("rsvps").insert({
                        wedding_id: weddingId,
                        guest_id: guestId,
                        function_id: functionId,
                        status: status,
                        total_pax: status === "confirmed" ? pax : 0,
                        dietary_preference: dietary,
                        needs_accommodation: status === "confirmed" && needsAccommodation,
                        responded_at: log.called_time
                    });
                }
            }
        }
        updatedCount++;
    }

    // Pass 4: Recalculate Wedding Function Aggregates
    const { data: allFunctions } = await supabase.from('wedding_functions').select('*').eq('wedding_id', weddingId);
    if (allFunctions) {
        for (const func of allFunctions) {
            const { data: funcRsvps } = await supabase.from('rsvps').select('*').eq('function_id', func.id).eq('status', 'confirmed');
            
            let total_pax = 0;
            let total_veg = 0;
            let total_nonveg = 0;
            let total_jain = 0;
            let total_acc = 0;

            if (funcRsvps) {
                for (const r of funcRsvps) {
                    total_pax += r.total_pax;
                    const pref = (r.dietary_preference || "").trim();
                    let isGeminiParsed = false;
                    let geminiData: any = null;

                    if (pref.startsWith("{")) {
                        try {
                            const parsed = JSON.parse(pref);
                            if (parsed._isGeminiParams) {
                                isGeminiParsed = true;
                                geminiData = parsed;
                            }
                        } catch (e) {}
                    }

                    if (r.needs_accommodation) {
                        if (isGeminiParsed && geminiData.accommodationCount !== undefined) {
                            total_acc += geminiData.accommodationCount;
                        } else {
                            total_acc += r.total_pax;
                        }
                    }

                    if (isGeminiParsed) {
                        total_veg += geminiData.veg || 0;
                        total_nonveg += geminiData.nonveg || 0;
                        total_jain += geminiData.jain || 0;
                    } else {
                        const prefLower = pref.toLowerCase();
                        if (prefLower === "veg" || prefLower === "vegetarian") {
                            total_veg += r.total_pax;
                        } else if (prefLower === "jain") {
                            total_jain += r.total_pax;
                        } else if (prefLower === "non-veg" || prefLower === "nonveg") {
                            total_nonveg += r.total_pax;
                        }
                    }
                }
            }

            await supabase.from('wedding_functions').update({
                total_pax: total_pax,
                dietary_veg: total_veg,
                dietary_nonveg: total_nonveg,
                dietary_jain: total_jain,
                accommodation_needed: total_acc
            }).eq('id', func.id);
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Synced ${updatedCount} RSVPs from Tabbly logs.`,
        logs_processed: logs.length
    });

  } catch (error: any) {
    console.error("Sync Error:", error);
    
    // Check for network/DNS/internet connectivity issues
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes("EAI_AGAIN") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("fetch failed")) {
        return NextResponse.json({ error: "Network error. Please check your internet connection." }, { status: 503 });
    }
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
