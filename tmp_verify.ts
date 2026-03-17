
import { createClient } from './lib/supabase/server'

async function verify() {
  const supabase = await createClient(true)
  
  const emails = ['admin@test.com', 'empresa@test.com']
  
  for (const email of emails) {
    console.log(`\n--- Verification for ${email} ---`)
    
    // Get user from auth.users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    const user = users?.find(u => u.email === email)
    
    if (authError || !user) {
      console.log(`Auth user not found for ${email}:`, authError?.message)
      continue
    }
    
    console.log(`User ID: ${user.id}`)
    console.log(`Role in metadata: ${user.user_metadata?.role}`)
    
    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      
    if (profileError) {
      console.log(`Profile error: ${profileError.message}`)
    } else {
      console.log(`Profile found: ${profile.first_name} ${profile.last_name}`)
    }
    
    // Check memberships
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      
    if (membersError) {
      console.log(`Memberships error: ${membersError.message}`)
    } else {
      console.log(`Memberships found: ${members.length}`)
      members.forEach(m => {
        console.log(`- Org: ${m.organizations.name} (Role: ${m.role})`)
      })
    }
  }
}

verify()
