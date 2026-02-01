/**
 * Fix duplicate phone number entries
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return;
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.substring(0, eqIndex)] = value;
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const phoneNumber = '+14074568607';

  console.log('Fixing duplicate phone number entries...\n');

  // Get all entries for this phone
  const { data: phones, error } = await supabase
    .from('phone_numbers')
    .select('id, number, business_id, is_active, created_at')
    .eq('number', phoneNumber)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Found', phones.length, 'entries for', phoneNumber);
  phones.forEach((p, i) => {
    console.log(`  ${i + 1}. ID: ${p.id}, Business: ${p.business_id}, Active: ${p.is_active}`);
  });

  if (phones.length <= 1) {
    console.log('\nNo duplicates to fix!');
    return;
  }

  // Keep the first one (oldest), deactivate or delete the rest
  const keep = phones[0];
  const remove = phones.slice(1);

  console.log('\nKeeping:', keep.id, '(business:', keep.business_id + ')');
  console.log('Removing:', remove.map(p => p.id).join(', '));

  for (const p of remove) {
    const { error: delError } = await supabase
      .from('phone_numbers')
      .delete()
      .eq('id', p.id);

    if (delError) {
      console.log('Error deleting', p.id + ':', delError.message);
    } else {
      console.log('Deleted', p.id);
    }
  }

  console.log('\nDone! Phone number now has only one entry.');
  console.log('Try calling again!');
}

main();
