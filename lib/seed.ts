// ============================================================
// WedSync — Demo Seed Script
// Run: npx tsx lib/seed.ts
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("🌱 Seeding WedSync demo data...\n");

  // 1. Create demo wedding
  const { data: wedding, error: weddingErr } = await supabase
    .from("weddings")
    .insert({
      planner_id: "demo-planner-001",
      wedding_name: "Sharma–Kapoor Wedding",
      bride_name: "Priya Sharma",
      groom_name: "Rahul Kapoor",
      wedding_date: "2026-04-15",
      template_id: "royal",
      total_guests: 12,
      total_confirmed: 0,
      total_declined: 0,
      total_pending: 12,
      total_pax: 0,
    })
    .select()
    .single();

  if (weddingErr || !wedding) {
    console.error("❌ Failed to create wedding:", weddingErr);
    return;
  }
  console.log(`✅ Wedding: ${wedding.wedding_name} (${wedding.id})`);

  // 2. Create functions
  const functionData = [
    { name: "Sangeet", date: "2026-04-13", time: "19:00", venue_name: "The Leela Palace, New Delhi", sort_order: 1 },
    { name: "Haldi", date: "2026-04-14", time: "10:00", venue_name: "Sharma Residence, Jaipur", sort_order: 2 },
    { name: "Wedding Ceremony", date: "2026-04-15", time: "11:00", venue_name: "The Leela Palace, New Delhi", sort_order: 3 },
    { name: "Reception", date: "2026-04-15", time: "19:00", venue_name: "The Leela Palace, New Delhi", sort_order: 4 },
  ];

  const { data: functions, error: funcErr } = await supabase
    .from("wedding_functions")
    .insert(functionData.map((f) => ({ ...f, wedding_id: wedding.id })))
    .select();

  if (funcErr || !functions) {
    console.error("❌ Failed to create functions:", funcErr);
    return;
  }
  console.log(`✅ Functions: ${functions.map((f) => f.name).join(", ")}`);

  // 3. Create guests
  const allFuncIds = functions.map((f) => f.id);
  const guestData = [
    { name: "Ranjeet Singh", phone: "+919876543210", side: "bride", tags: ["vip", "family"] },
    { name: "Deepika Patel", phone: "+919876543211", side: "groom", tags: ["family"] },
    { name: "Vikram Malhotra", phone: "+919876543212", side: "bride", tags: ["vip", "friend"] },
    { name: "Anita Gupta", phone: "+919876543213", side: "groom", tags: ["friend"] },
    { name: "Sanjay Kumar", phone: "+919876543214", side: "both", tags: ["vip", "family", "outstation"] },
    { name: "Meera Joshi", phone: "+919876543215", side: "bride", tags: ["colleague"] },
    { name: "Rajesh Verma", phone: "+919876543216", side: "groom", tags: ["friend", "outstation"] },
    { name: "Pooja Reddy", phone: "+919876543217", side: "bride", tags: ["family"] },
    { name: "Amit Saxena", phone: "+919876543218", side: "groom", tags: ["colleague"] },
    { name: "Neha Chawla", phone: "+919876543219", side: "both", tags: ["friend", "outstation"] },
    { name: "Karan Chopra", phone: "+919876543220", side: "bride", tags: ["family"] },
    { name: "Simran Kaur", phone: "+919876543221", side: "groom", tags: ["family", "vip"] },
  ];

  const { data: guests, error: guestErr } = await supabase
    .from("guests")
    .insert(
      guestData.map((g) => ({
        ...g,
        wedding_id: wedding.id,
        function_ids: allFuncIds,
        overall_status: "pending",
        imported_via: "manual",
      }))
    )
    .select();

  if (guestErr || !guests) {
    console.error("❌ Failed to create guests:", guestErr);
    return;
  }
  console.log(`✅ Guests: ${guests.length} added`);

  // 4. Create invite tokens
  const { error: tokenErr } = await supabase.from("invite_tokens").insert(
    guests.map((g) => ({
      token: g.invite_token,
      wedding_id: wedding.id,
      guest_id: g.id,
      function_ids: allFuncIds,
    }))
  );

  if (tokenErr) {
    console.error("❌ Failed to create tokens:", tokenErr);
    return;
  }
  console.log(`✅ Invite tokens: ${guests.length} created`);

  // 5. Create some sample RSVPs (simulate partial responses)
  const sampleRsvps = [
    // Ranjeet — confirmed for all
    ...allFuncIds.map((fid) => ({
      wedding_id: wedding.id,
      guest_id: guests[0].id,
      function_id: fid,
      invite_token: guests[0].invite_token,
      status: "confirmed",
      plus_ones: 2,
      children: 1,
      total_pax: 4,
      dietary_preference: "veg",
      needs_accommodation: false,
      responded_at: new Date().toISOString(),
    })),
    // Deepika — confirmed for Sangeet, declined others
    {
      wedding_id: wedding.id,
      guest_id: guests[1].id,
      function_id: functions[0].id,
      invite_token: guests[1].invite_token,
      status: "confirmed",
      plus_ones: 1,
      children: 0,
      total_pax: 2,
      dietary_preference: "non-veg",
      needs_accommodation: false,
      responded_at: new Date().toISOString(),
    },
    {
      wedding_id: wedding.id,
      guest_id: guests[1].id,
      function_id: functions[3].id,
      invite_token: guests[1].invite_token,
      status: "declined",
      plus_ones: 0,
      children: 0,
      total_pax: 0,
      dietary_preference: null,
      needs_accommodation: false,
      responded_at: new Date().toISOString(),
    },
    // Sanjay — confirmed with accommodation
    ...allFuncIds.map((fid) => ({
      wedding_id: wedding.id,
      guest_id: guests[4].id,
      function_id: fid,
      invite_token: guests[4].invite_token,
      status: "confirmed",
      plus_ones: 3,
      children: 2,
      total_pax: 6,
      dietary_preference: "jain",
      needs_accommodation: true,
      responded_at: new Date().toISOString(),
    })),
  ];

  const { error: rsvpErr } = await supabase.from("rsvps").insert(sampleRsvps);

  if (rsvpErr) {
    console.error("❌ Failed to create RSVPs:", rsvpErr);
    return;
  }
  console.log(`✅ RSVPs: ${sampleRsvps.length} sample responses created`);

  // 6. Update wedding counts
  const confirmedCount = sampleRsvps.filter((r) => r.status === "confirmed").length;
  const declinedCount = sampleRsvps.filter((r) => r.status === "declined").length;
  const totalPax = sampleRsvps
    .filter((r) => r.status === "confirmed")
    .reduce((sum, r) => sum + r.total_pax, 0);

  await supabase
    .from("weddings")
    .update({
      total_confirmed: 3,
      total_declined: 0,
      total_pending: 9,
      total_pax: totalPax,
    })
    .eq("id", wedding.id);

  // Update guest statuses
  await supabase.from("guests").update({ overall_status: "confirmed", invite_sent_at: new Date().toISOString() }).eq("id", guests[0].id);
  await supabase.from("guests").update({ overall_status: "partial", invite_sent_at: new Date().toISOString() }).eq("id", guests[1].id);
  await supabase.from("guests").update({ overall_status: "confirmed", invite_sent_at: new Date().toISOString() }).eq("id", guests[4].id);

  console.log("\n🎉 Seed data complete!");
  console.log(`\n📋 Demo invite links:`);
  for (const g of guests.slice(0, 5)) {
    console.log(`  ${g.name}: http://localhost:3000/invite/${g.invite_token}`);
  }
}

seed().catch(console.error);
