import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKey = process.env.ENCRYPTION_KEY;

if (!supabaseUrl || !supabaseServiceKey || !encryptionKey) {
  console.error('Missing environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
  return crypto.createHash('sha256').update(encryptionKey).digest();
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (typeof plaintext !== 'string') return plaintext;
  if (plaintext.includes(':') && plaintext.split(':').length === 3) return plaintext;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const hash = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, hash, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

async function migrate() {
  console.log('--- Starting Final Security Migration ---');
  
  // 1. Migrate Guests
  const { data: guests } = await supabase.from('guests').select('id, phone, email');
  let guestsUpdated = 0;
  for (const guest of guests || []) {
    const updateData = {};
    let needsUpdate = false;
    if (guest.phone && !guest.phone.includes(':')) {
      updateData.phone = encrypt(guest.phone);
      needsUpdate = true;
    }
    if (guest.email && !guest.email.includes(':')) {
      updateData.email = encrypt(guest.email);
      needsUpdate = true;
    }
    if (needsUpdate) {
      await supabase.from('guests').update(updateData).eq('id', guest.id);
      guestsUpdated++;
    }
  }
  console.log(`Guests checked/updated: ${guestsUpdated}`);

  // 2. Migrate SMTP Settings
  const { data: settings } = await supabase.from('planner_smtp_settings').select('planner_id, smtp_email');
  let smtpUpdated = 0;
  for (const s of settings || []) {
    if (s.smtp_email && !s.smtp_email.includes(':')) {
      await supabase.from('planner_smtp_settings').update({ smtp_email: encrypt(s.smtp_email) }).eq('planner_id', s.planner_id);
      smtpUpdated++;
    }
  }
  console.log(`SMTP settings checked/updated: ${smtpUpdated}`);

  // 3. Migrate Communication Logs
  const { data: logs } = await supabase.from('communication_logs').select('id, payload');
  let logsUpdated = 0;
  for (const log of logs || []) {
    if (!log.payload) continue;
    let needsUpdate = false;
    const newPayload = { ...log.payload };

    if (newPayload.to && typeof newPayload.to === 'string' && !newPayload.to.includes(':')) {
      newPayload.to = encrypt(newPayload.to);
      needsUpdate = true;
    }
    if (newPayload.phone && typeof newPayload.phone === 'string' && !newPayload.phone.includes(':')) {
      newPayload.phone = encrypt(newPayload.phone);
      needsUpdate = true;
    }
    if (newPayload.transcript && typeof newPayload.transcript === 'string' && !newPayload.transcript.includes(':')) {
      newPayload.transcript = encrypt(newPayload.transcript);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await supabase.from('communication_logs').update({ payload: newPayload }).eq('id', log.id);
      logsUpdated++;
    }
  }
  console.log(`Communication logs checked/updated: ${logsUpdated}`);
  
  console.log('--- Migration Complete ---');
}

migrate();
