const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gykyxmgnwkxnatzbvvwu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5a3l4bWdud2t4bmF0emJ2dnd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwMjcxNCwiZXhwIjoyMDgxNzc4NzE0fQ.gHDwQ3C0svuyBBQsgjtS7jXIPmPh8x907HRk04cNuqM'
);

async function makeAdmin() {
  const email = 'moursedeveloping@gmail.com';

  // Get user by email
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error('User not found with email:', email);
    return;
  }

  console.log('Found user:', user.id, user.email);

  // Update user app_metadata
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, is_admin: true }
  });

  if (error) {
    console.error('Error updating user:', error);
    return;
  }

  console.log('Updated app_metadata for user');

  // Update profile role
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
  } else {
    console.log('Updated profile role');
  }

  console.log('\n✅ SUCCESS: User is now an admin!');
  console.log('Please log out and log back in, then visit /admin');
}

makeAdmin();
