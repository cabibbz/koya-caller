/**
 * Show raw Netapp knowledge base from Koya database
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

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== RAW KOYA DATABASE CONTENT FOR NETAPP ===\n');

  // Business info
  const { data: business } = await supabase
    .from('businesses')
    .select('name, differentiator')
    .eq('id', businessId)
    .single();

  console.log('Business Name:', business?.name);
  console.log('Differentiator:', business?.differentiator || '(none)');

  // FAQs
  const { data: faqs } = await supabase
    .from('faqs')
    .select('question, answer')
    .eq('business_id', businessId)
    .order('sort_order');

  console.log('\n--- FAQs (' + (faqs?.length || 0) + ') ---');
  faqs?.forEach((f, i) => {
    console.log('\n' + (i+1) + '. Q: ' + f.question);
    console.log('   A: ' + f.answer);
  });

  // Services
  const { data: services } = await supabase
    .from('services')
    .select('name, description')
    .eq('business_id', businessId)
    .order('sort_order');

  console.log('\n--- Services (' + (services?.length || 0) + ') ---');
  services?.forEach((s, i) => {
    console.log((i+1) + '. ' + s.name + (s.description ? ': ' + s.description : ''));
  });

  // Additional knowledge
  const { data: knowledge } = await supabase
    .from('knowledge')
    .select('content')
    .eq('business_id', businessId)
    .single();

  console.log('\n--- Additional Knowledge ---');
  console.log(knowledge?.content || '(none)');
}

main();
