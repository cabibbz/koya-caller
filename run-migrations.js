// Run migrations against Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const migrations = [
  '20250120000001_sms_opt_outs.sql',
  '20250121000001_auth_events.sql',
  '20250121000001_data_requests.sql',
  '20250121000001_trial_period.sql'
];

async function runMigrations() {
  console.log('Starting migrations...\n');

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'supabase', 'migrations', migration);

    if (!fs.existsSync(filePath)) {
      console.error(`Migration file not found: ${migration}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running: ${migration}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
        console.log(`  Note: Using Supabase dashboard may be required for DDL`);
        console.log(`  Error: ${error.message}`);
      } else {
        console.log(`  ✓ Success`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log('\nMigrations complete!');
  console.log('\nIf any migrations failed, please run them manually in the Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/jkfcipjastgqtusijbav/sql');
}

runMigrations();
