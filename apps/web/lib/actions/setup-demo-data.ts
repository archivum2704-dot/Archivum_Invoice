'use server'

import { createClient } from '@/lib/supabase/server'

export async function setupDemoUsers() {
  const supabase = await createClient(true)

  try {
    // Create admin user
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@test.com',
      password: 'Admin123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
      },
    })

    if (adminError && !adminError.message.includes('already exists')) {
      throw adminError
    }

    // Create company user
    const { data: companyData, error: companyError } = await supabase.auth.admin.createUser({
      email: 'empresa@test.com',
      password: 'Empresa123!',
      email_confirm: true,
      user_metadata: {
        first_name: 'Juan',
        last_name: 'García',
        role: 'company_user',
      },
    })

    if (companyError && !companyError.message.includes('already exists')) {
      throw companyError
    }

    // Create profiles for both users
    const adminId = adminData?.user?.id
    const companyId = companyData?.user?.id

    if (adminId) {
      await supabase.from('profiles').upsert({
        id: adminId,
        email: 'admin@test.com',
        first_name: 'Admin',
        last_name: 'User',
      })
    }

    if (companyId) {
      await supabase.from('profiles').upsert({
        id: companyId,
        email: 'empresa@test.com',
        first_name: 'Juan',
        last_name: 'García',
      })
    }

    return {
      success: true,
      adminId,
      companyId,
    }
  } catch (error) {
    console.error('Error setting up demo data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
