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
  if (!plaintext) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

async function migrate() {
  console.log('--- Starting Guest Encryption Migration ---');
  
  const { data: guests, error } = await supabase
    .from('guests')
    .select('id, phone, email');

  if (error) {
    console.error('Error fetching guests:', error);
    return;
  }

  console.log(`Found ${guests.length} guests to check.`);

  let updatedCount = 0;

  for (const guest of guests) {
    let needsUpdate = false;
    const updateData = {};

    if (guest.phone && !guest.phone.includes(':')) {
      updateData.phone = encrypt(guest.phone);
      needsUpdate = true;
    }

    if (guest.email && !guest.email.includes(':')) {
      updateData.email = encrypt(guest.email);
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('guests')
        .update(updateData)
        .eq('id', guest.id);

      if (updateError) {
        console.error(`Failed to update guest ${guest.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Migration complete! Updated ${updatedCount} guests.`);
}

migrate();
