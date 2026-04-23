import { parseRSVPFromTranscript as regexFallback } from "./rsvp-parser";

export type RSVPResult = {
    attending: boolean | null;
    guestCount: number | null;
    dietaryRequirements: string | null;
    notes: string | null;
    confidence: "high" | "low";
    status?: string; // added for backward compatibility with sync route
    accommodationNeeded?: boolean;
    accommodationCount?: number;
};

// Retry helper
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok || res.status === 400) return res;
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1))); // backoff
                continue;
            }
            if (i === maxRetries - 1) return res;
        } catch (e) {
            if (i === maxRetries - 1) throw e;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Max retries reached");
}

function safeJsonParse(text: string): any | null {
    try { return JSON.parse(text); } catch {}
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch {} }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
    return null;
}

function unwrapArray(parsed: any): any[] | null {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        for (const key of ['data', 'results', 'rsvps', 'guests', 'items']) {
            if (Array.isArray(parsed[key])) return parsed[key];
        }
    }
    return null;
}

const RSVP_PROMPT = `You are an RSVP data extractor. Parse the call transcript and extract guest response.

RULES:
- Return ONLY a valid JSON array with ONE object inside, no extra text or markdown.
- Each object MUST have exactly these fields: id, status, guestCount, dietaryPreference, accommodationNeeded, accommodationCount, notes.
- status MUST be one of: "confirmed", "declined", "pending". Default to "pending" if unclear.
- guestCount is an integer >= 0. If declined, set to 0. If confirmed but count unclear, set to 1.
- dietaryPreference is one of: "veg", "non-veg", "jain", or null if not mentioned.
- accommodationNeeded is a boolean. Default false.
- accommodationCount is an integer >= 0.
- notes is a string for any special requests, or null.

REQUIRED OUTPUT FORMAT (no wrapping, no explanation):
[{"id":"guest-123","status":"confirmed","guestCount":2,"dietaryPreference":"veg","accommodationNeeded":false,"accommodationCount":0,"notes":null}]

Transcript:
`;

export async function parseRSVPFromTranscript(transcript: string, guestName: string): Promise<RSVPResult> {
    const fullPrompt = RSVP_PROMPT + JSON.stringify([{ id: guestName || "guest-123", transcript }]);
    
    // Try 1: Gemini
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
                    const arr = unwrapArray(parsed);
                    if (arr && arr.length > 0) {
                        const entry = arr[0];
                        return {
                            attending: entry.status === "confirmed" ? true : entry.status === "declined" ? false : null,
                            guestCount: entry.guestCount ?? (entry.status === "confirmed" ? 1 : null),
                            dietaryRequirements: entry.dietaryPreference || null,
                            notes: entry.notes || null,
                            confidence: "high",
                            status: entry.status,
                            accommodationNeeded: entry.accommodationNeeded || false,
                            accommodationCount: entry.accommodationCount || 0
                        };
                    }
                }
            }
        } catch (err) {
            console.error("Gemini parse error in webhook:", err);
        }
    }

    // Try 2: Groq
    if (process.env.GROQ_API_KEY) {
        try {
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
                    let arr = unwrapArray(parsed);
                    // Groq sometimes wraps in a single object if response_format is json_object
                    if (!arr && parsed && typeof parsed === 'object') {
                       arr = [parsed];
                    }
                    if (arr && arr.length > 0) {
                        const entry = arr[0];
                        return {
                            attending: entry.status === "confirmed" ? true : entry.status === "declined" ? false : null,
                            guestCount: entry.guestCount ?? (entry.status === "confirmed" ? 1 : null),
                            dietaryRequirements: entry.dietaryPreference || null,
                            notes: entry.notes || null,
                            confidence: "high",
                            status: entry.status,
                            accommodationNeeded: entry.accommodationNeeded || false,
                            accommodationCount: entry.accommodationCount || 0
                        };
                    }
                }
            }
        } catch (err) {
            console.error("Groq parse error in webhook:", err);
        }
    }

    // Try 3: Regex Fallback
    const fallback = await regexFallback(transcript);
    return {
        attending: fallback.status === "confirmed" ? true : fallback.status === "declined" ? false : null,
        guestCount: fallback.total_pax ?? (fallback.status === "confirmed" ? 1 : null),
        dietaryRequirements: fallback.dietary_preference || null,
        notes: null,
        confidence: "low",
        status: fallback.status,
        accommodationNeeded: fallback.needs_accommodation || false,
        accommodationCount: fallback.needs_accommodation ? fallback.total_pax : 0
    };
}
