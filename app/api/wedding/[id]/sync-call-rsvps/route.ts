import { NextResponse } from "next/server";
import { requireWeddingOwner } from "@/lib/api-auth";
import { parseRSVPFromTranscript } from "@/lib/rsvp-parser";

const TABBLY_API_KEY = process.env.TABBLY_API_KEY || "";
const TABBLY_ORGANIZATION_ID = process.env.TABBLY_ORGANIZATION_ID || "";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Safely parse JSON — never throws. Handles markdown wrappers, extra text. */
function safeJsonParse(text: string): any | null {
    try { return JSON.parse(text); } catch {}
    // Strip markdown code fences
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
    // Try extracting first JSON array or object
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch {} }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
    return null;
}

/** Unwrap LLM response that might be wrapped: { data: [...] } or { results: [...] } */
function unwrapArray(parsed: any): any[] | null {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        for (const key of ['data', 'results', 'rsvps', 'guests', 'items']) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return null;
}

const VALID_STATUSES = new Set(["confirmed", "declined", "pending"]);
const VALID_DIETARY = new Set(["veg", "non-veg", "nonveg", "jain", "vegetarian", ""]);

/** Validate and sanitize a single RSVP entry from LLM output */
function validateRsvpEntry(entry: any): { id: string; status: string; pax: number; dietary: string | null; needsAccommodation: boolean; accommodationCount: number } | null {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.id !== 'string' || !entry.id) return null;

    const status = String(entry.status || "").toLowerCase().trim();
    if (!VALID_STATUSES.has(status)) return null;

    const pax = Math.max(0, Math.min(100, parseInt(entry.guestCount ?? entry.pax ?? "0") || 0));

    let dietary: string | null = null;
    const rawDietary = entry.dietaryPreference ?? entry.dietary ?? null;
    if (typeof rawDietary === 'string' && rawDietary.trim()) {
        dietary = rawDietary.trim().toLowerCase();
        // Normalize common variants
        if (dietary === 'nonveg' || dietary === 'non veg' || dietary === 'non-vegetarian') dietary = 'non-veg';
        if (dietary === 'vegetarian') dietary = 'veg';
    } else if (typeof rawDietary === 'object' && rawDietary !== null) {
        // Gemini sometimes returns { veg: N, nonveg: N, jain: N }
        const v = rawDietary.veg || 0, nv = rawDietary.nonveg || 0, j = rawDietary.jain || 0;
        if (nv >= v && nv >= j) dietary = 'non-veg';
        else if (j >= v) dietary = 'jain';
        else dietary = 'veg';
    }

    const needsAccommodation = Boolean(entry.accommodationNeeded ?? entry.needsAccommodation ?? false);
    const accommodationCount = Math.max(0, parseInt(entry.accommodationCount || "0") || 0);

    return { id: entry.id, status, pax: status === "declined" ? 0 : (pax || (status === "confirmed" ? 1 : 0)), dietary, needsAccommodation: status === "confirmed" && needsAccommodation, accommodationCount };
}

/** Fetch with retry on 429 / 5xx (max 2 attempts) */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 1): Promise<Response> {
    let lastResponse: Response | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        lastResponse = await fetch(url, options);
        if (lastResponse.ok || (lastResponse.status !== 429 && lastResponse.status < 500)) {
            return lastResponse;
        }
        // Wait before retry (500ms first, 1500ms second)
        if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 + attempt * 1000));
        }
    }
    return lastResponse!;
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: weddingId } = await params;

    const authResult = await requireWeddingOwner(weddingId);
    if ("error" in authResult) return authResult.error;
    const { supabase } = authResult;

    if (!TABBLY_API_KEY || !TABBLY_ORGANIZATION_ID) {
      return NextResponse.json({ error: "Tabbly credentials missing" }, { status: 500 });
    }

    // Support a configurable limit via request body (default: 10)
    let fetchLimit = 10;
    try {
      const body = await req.json();
      if (body?.limit && typeof body.limit === "number" && body.limit > 0) {
        fetchLimit = Math.min(body.limit, 100); // cap at 100
      }
    } catch {
      // No body or invalid JSON — use default limit
    }

    // Fetch latest call logs from Tabbly
    const response = await fetch(`https://www.tabbly.io/dashboard/agents/endpoints/call-logs-v2?api_key=${TABBLY_API_KEY}&organization_id=${TABBLY_ORGANIZATION_ID}&limit=${fetchLimit}`);
    
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

    // ─── Pass 1: Classify call logs ────────────────────────────────────
    for (const log of logs) {
        const guestId = log.custom_identifiers; 
        const transcript = log.call_transcript || log.call_summary || "";

        if (!guestId || typeof guestId !== 'string') continue;

        // Detect unanswered calls: Tabbly's call_status can be unreliable
        // (e.g. shows "Not Answered" even for 140-sec conversations with full transcripts)
        // So we require BOTH a bad call_status AND a short/empty transcript
        const callDuration = parseInt(log.call_duration || log.duration || "0") || 0;
        const tabblyCallStatus = String(log.call_status || log.status || "").toLowerCase();
        const hasShortTranscript = transcript.trim().length < 50 || transcript.includes("No Call Transcript Available");
        
        const isBadStatus = 
            tabblyCallStatus === "no_answer" || 
            tabblyCallStatus === "not answered" ||
            tabblyCallStatus === "not_answered" ||
            tabblyCallStatus === "busy" || 
            tabblyCallStatus === "failed";

        // Only consider unanswered if BOTH: bad status AND no meaningful transcript
        const isUnanswered = (isBadStatus && hasShortTranscript) || (callDuration === 0 && hasShortTranscript);

        if (isUnanswered) {
            // Only mark as unanswered if we don't already have a better (answered) log for this guest
            if (!structuredDataMap.has(guestId) || structuredDataMap.get(guestId)?.unanswered) {
                structuredDataMap.set(guestId, { log, unanswered: true });
            }
            continue;
        }

        const dataSource = log.variables || log.extracted_data || {};
        // Answered call always overrides any previous unanswered entry
        structuredDataMap.set(guestId, { log });

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

    // ─── Pass 2: LLM Transcript Parsing (Gemini → Groq → local regex) ─
    if (transcriptsToParse.length > 0) {
        const RSVP_PROMPT = `You are an RSVP data extractor. Parse the call transcripts and extract guest responses.

RULES:
- Return ONLY a valid JSON array, no extra text or markdown.
- Each object MUST have exactly these fields: id, status, guestCount, dietaryPreference, accommodationNeeded, accommodationCount.
- status MUST be one of: "confirmed", "declined", "pending". Default to "pending" if unclear.
- guestCount is an integer >= 0. If declined, set to 0. If confirmed but count unclear, set to 1.
- dietaryPreference is one of: "veg", "non-veg", "jain", or null if not mentioned.
- accommodationNeeded is a boolean. Default false.
- accommodationCount is an integer >= 0.

REQUIRED OUTPUT FORMAT (no wrapping, no explanation):
[{"id":"...","status":"confirmed","guestCount":2,"dietaryPreference":"veg","accommodationNeeded":false,"accommodationCount":0}]

Transcripts:
`;

        // Helper: validate + apply LLM response
        function processLLMResponse(raw: any): boolean {
            const arr = unwrapArray(raw);
            if (!arr || arr.length === 0) return false;
            let anyValid = false;
            for (const entry of arr) {
                const validated = validateRsvpEntry(entry);
                if (!validated) continue;
                const guestData = structuredDataMap.get(validated.id);
                if (guestData) {
                    Object.assign(guestData, {
                        status: validated.status,
                        pax: validated.pax,
                        dietary: validated.dietary,
                        needsAccommodation: validated.needsAccommodation,
                        accommodationCount: validated.accommodationCount
                    });
                    anyValid = true;
                }
            }
            return anyValid;
        }

        // Process in chunks of 25
        for (let i = 0; i < transcriptsToParse.length; i += 25) {
            const chunk = transcriptsToParse.slice(i, i + 25);
            const fullPrompt = RSVP_PROMPT + JSON.stringify(chunk);
            let llmSuccess = false;

            // Try 1: Gemini 2.5 Flash
            if (process.env.GEMINI_API_KEY) {
                try {
                    const geminiRes = await fetchWithRetry(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-goog-api-key': process.env.GEMINI_API_KEY!,
                            },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: fullPrompt }] }],
                                generationConfig: { responseMimeType: "application/json" }
                            })
                        }
                    );
                    
                    if (geminiRes.ok) {
                        const data = await geminiRes.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            const parsed = safeJsonParse(text);
                            if (parsed) {
                                llmSuccess = processLLMResponse(parsed);
                            }
                        }
                    } else {
                        console.error("Gemini API Error:", geminiRes.status);
                    }
                } catch (err) {
                    console.error("Gemini parse error:", err);
                }
            }

            // Try 2: Groq fallback (llama-3.3-70b-versatile)
            if (!llmSuccess && process.env.GROQ_API_KEY) {
                try {
                    console.log("Gemini unavailable, falling back to Groq...");
                    const groqRes = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                { role: 'system', content: 'You are an RSVP data extractor. Respond with a valid JSON array only. No markdown, no explanation.' },
                                { role: 'user', content: fullPrompt }
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
                                llmSuccess = processLLMResponse(parsed);
                            }
                        }
                    } else {
                        console.error("Groq API Error:", groqRes.status);
                    }
                } catch (err) {
                    console.error("Groq parse error:", err);
                }
            }
        }
    } 
    
    // Pass 2B: Local regex fallback for any still-unparsed transcripts
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

    // ─── Pass 3: Database Updates (batch-optimized) ────────────────────
    
    // Batch-fetch all guest call_statuses to avoid N+1 queries
    const guestIds = Array.from(structuredDataMap.keys());
    const guestStatusMap = new Map<string, string>();
    if (guestIds.length > 0) {
        const { data: guestsData } = await supabase
            .from("guests")
            .select("id, call_status, function_ids")
            .eq("wedding_id", weddingId)
            .in("id", guestIds);
        if (guestsData) {
            for (const g of guestsData) {
                guestStatusMap.set(g.id, g.call_status);
            }
        }
    }

    // Track processed guests to prevent duplicates
    const processedGuests = new Set<string>();

    // ─── Bulk Fetching for Pass 3 ──────────────────────────────────────
    const guestIdsToProcess = Array.from(structuredDataMap.keys());
    updatedCount = 0;

    if (guestIdsToProcess.length > 0) {
        // Fetch all affected guests (for function_ids)
        const { data: guestsData } = await supabase
            .from("guests")
            .select("id, function_ids")
            .in("id", guestIdsToProcess);
        const guestFuncs = new Map(guestsData?.map((g: any) => [g.id, g.function_ids]) || []);

        // Fetch all existing RSVPs for these guests
        const { data: existingRsvps } = await supabase
            .from("rsvps")
            .select("id, guest_id, function_id")
            .in("guest_id", guestIdsToProcess)
            .eq("wedding_id", weddingId);
        const rsvpMap = new Map(existingRsvps?.map((r: any) => [`${r.guest_id}_${r.function_id}`, r.id]) || []);

        const guestUpdatePromises = [];
        const rsvpsToUpsert: any[] = [];

        for (const [guestId, data] of structuredDataMap.entries()) {
            if (processedGuests.has(guestId)) continue;
            processedGuests.add(guestId);

            const { status, pax, dietary, needsAccommodation, log, unanswered } = data;

            if (guestStatusMap.get(guestId) === "responded") continue;

            if (unanswered) {
                guestUpdatePromises.push(
                    supabase.from("guests")
                        .update({ call_status: "not_responded" })
                        .eq("id", guestId)
                        .eq("wedding_id", weddingId)
                );
                continue;
            }

            if (!status || status === "pending") {
                guestUpdatePromises.push(
                    supabase.from("guests")
                        .update({ call_status: "not_responded" })
                        .eq("id", guestId)
                        .eq("wedding_id", weddingId)
                );
                continue;
            }

            // Queue guest update
            guestUpdatePromises.push(
                supabase.from("guests")
                    .update({
                        overall_status: status,
                        call_status: "responded"
                    })
                    .eq("id", guestId)
                    .eq("wedding_id", weddingId)
            );

            // Queue RSVP upserts
            const funcIds = guestFuncs.get(guestId);
            if (funcIds && Array.isArray(funcIds)) {
                for (const functionId of funcIds) {
                    const rsvpData: any = {
                        wedding_id: weddingId,
                        guest_id: guestId,
                        function_id: functionId,
                        status: status,
                        total_pax: status === "confirmed" ? (pax || 1) : 0,
                        dietary_preference: dietary,
                        needs_accommodation: status === "confirmed" && needsAccommodation,
                        responded_at: log.called_time
                    };

                    const existingId = rsvpMap.get(`${guestId}_${functionId}`);
                    if (existingId) {
                        rsvpData.id = existingId; // Update existing
                    }
                    rsvpsToUpsert.push(rsvpData);
                }
            }
            updatedCount++;
        }

        // Execute bulk updates
        await Promise.all(guestUpdatePromises);

        if (rsvpsToUpsert.length > 0) {
            const { error: upsertErr } = await supabase.from("rsvps").upsert(rsvpsToUpsert);
            if (upsertErr) console.error("RSVP bulk upsert failed:", upsertErr);
        }
    }

    // ─── Pass 4: Recalculate Function Aggregates ───────────────────────
    // Bulk fetch to avoid N+1
    const { data: allFunctions } = await supabase.from('wedding_functions').select('id').eq('wedding_id', weddingId);
    const { data: allWeddingRsvps } = await supabase.from('rsvps').select('*').eq('wedding_id', weddingId);
    
    if (allFunctions && allWeddingRsvps) {
        const functionUpdatePromises = allFunctions.map((func) => {
            const funcRsvps = allWeddingRsvps.filter(r => r.function_id === func.id);
            
            let total_pax = 0, total_veg = 0, total_nonveg = 0, total_jain = 0, total_acc = 0;
            let funcConfirmed = 0, funcDeclined = 0, funcPending = 0;

            for (const r of funcRsvps) {
                if (r.status === 'confirmed') funcConfirmed++;
                else if (r.status === 'declined') funcDeclined++;
                else funcPending++;

                if (r.status !== 'confirmed') continue;
                total_pax += r.total_pax || 0;
                
                const rawPref = (r.dietary_preference || "").trim();
                let pref = rawPref;
                let isGeminiParsed = false;
                let geminiData: any = null;
                let accCount = 1; // Default: 1 accommodation per guest (not total_pax)

                if (rawPref.startsWith("{")) {
                    try {
                        const parsed = JSON.parse(rawPref);
                        if (parsed._isGeminiParams) {
                            isGeminiParsed = true;
                            geminiData = parsed;
                        } else if (parsed.acc !== undefined) {
                            pref = parsed.pref || "";
                            accCount = parsed.acc;
                        }
                    } catch (e) {}
                }

                if (r.needs_accommodation) {
                    if (isGeminiParsed && geminiData.accommodationCount !== undefined) {
                        total_acc += geminiData.accommodationCount;
                    } else {
                        total_acc += accCount;
                    }
                }

                if (isGeminiParsed) {
                    total_veg += geminiData.veg || 0;
                    total_jain += geminiData.jain || 0;
                    total_nonveg += geminiData.nonveg || 0;
                } else {
                    // Count 1 explicit preference per guest, not multiplied by total_pax
                    const prefLower = pref.toLowerCase();
                    if (prefLower === "veg" || prefLower === "vegetarian") total_veg += 1;
                    else if (prefLower === "jain") total_jain += 1;
                    else if (prefLower === "non-veg" || prefLower === "nonveg") total_nonveg += 1;
                }
            }

            return supabase.from('wedding_functions').update({
                confirmed: funcConfirmed,
                declined: funcDeclined,
                pending: funcPending,
                total_pax,
                dietary_veg: total_veg,
                dietary_nonveg: total_nonveg,
                dietary_jain: total_jain,
                accommodation_needed: total_acc
            }).eq('id', func.id);
        });

        await Promise.all(functionUpdatePromises);
    }

    // ─── Pass 5: Recalculate Wedding-Level Aggregates ──────────────────
    const { data: allGuests } = await supabase.from('guests').select('overall_status').eq('wedding_id', weddingId);
    const { data: allRsvps } = await supabase.from('rsvps').select('total_pax, status').eq('wedding_id', weddingId);
    if (allGuests) {
        const wConfirmed = allGuests.filter(g => g.overall_status === 'confirmed').length;
        const wDeclined = allGuests.filter(g => g.overall_status === 'declined').length;
        const wPending = allGuests.filter(g => g.overall_status === 'pending' || g.overall_status === 'partial').length;
        const wTotalPax = (allRsvps || []).filter(r => r.status === 'confirmed').reduce((s, r) => s + (r.total_pax || 0), 0);
        await supabase.from('weddings').update({
            total_guests: allGuests.length,
            total_confirmed: wConfirmed,
            total_declined: wDeclined,
            total_pending: wPending,
            total_pax: wTotalPax
        }).eq('id', weddingId);
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
