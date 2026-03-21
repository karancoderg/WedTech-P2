export async function parseRSVPFromTranscript(transcript: string) {
  try {
    const text = transcript.toLowerCase();
    
    // Default assumptions
    let status = "pending";
    let total_pax = 1; // Default to 1 if attending
    let dietary_preference = null;

    // 1. Status Keyword Matching
    const confirmedKeywords = ["yes", "attending", "will be there", "i can make it", "we can make it", "coming", "confirmed", "definitely"];
    const declinedKeywords = ["no", "not attending", "won't be there", "cannot make it", "can't make it", "decline", "sorry", "busy", "unable to"];
    
    // Check decline first as "I am sorry but no" might trigger both
    const isDeclined = declinedKeywords.some(keyword => text.includes(keyword));
    const isConfirmed = confirmedKeywords.some(keyword => text.includes(keyword));

    if (isDeclined && !isConfirmed) {
      status = "declined";
      total_pax = 0;
    } else if (isConfirmed) {
      status = "confirmed";
    }

    // 2. Pax Extraction (looking for numbers near "people", "guests", "of us")
    if (status === "confirmed") {
        const paxMatch = text.match(/(?:bring|with|total of|just)\s*(one|two|three|four|five|six|seven|eight|1|2|3|4|5|6|7|8)\s*(?:people|guests|of us|more|extra)?/);
        
        if (paxMatch && paxMatch[1]) {
            const wordToNum: Record<string, number> = { "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8 };
            total_pax = wordToNum[paxMatch[1]] || parseInt(paxMatch[1], 10) || 1;
        }
    }

    // 3. Dietary Preference
    if (text.includes("non veg") || text.includes("non-veg") || text.includes("chicken") || text.includes("meat") || text.includes("fish")) {
        dietary_preference = "non-veg";
    } else if (text.includes("jain") || text.includes("no onion") || text.includes("no garlic")) {
        dietary_preference = "jain";
    } else if (text.includes("veg") || text.includes("vegetarian") || text.includes("vegan")) {
        dietary_preference = "veg";
    }

    // 4. Accommodation Detection
    let needs_accommodation = false;
    const noAccommodationKeywords = ["no accommodation", "don't need accommodation", "do not need accommodation", "no hotel", "no room", "staying with family", "staying at home", "local", "nearby"];
    const yesAccommodationKeywords = ["need accommodation", "need a hotel", "need a room", "need hotel", "need room", "book a room", "book a hotel", "accommodation", "hotel", "stay arrangement"];

    const noAccommodation = noAccommodationKeywords.some(keyword => text.includes(keyword));
    const yesAccommodation = yesAccommodationKeywords.some(keyword => text.includes(keyword));

    if (yesAccommodation && !noAccommodation) {
        needs_accommodation = true;
    }

    return {
      status,
      total_pax,
      dietary_preference,
      needs_accommodation
    };
  } catch (error) {
    console.error("Local Parsing Error:", error);
    return {
      status: "pending",
      total_pax: 0,
      dietary_preference: null,
      needs_accommodation: false
    };
  }
}
