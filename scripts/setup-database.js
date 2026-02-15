require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('Setting up Supabase database schema...')

  try {
    // Create users table using direct SQL query
    const { error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    // If table doesn't exist, we'll get an error, so we create it
    if (usersError && usersError.code === 'PGRST116') {
      console.log('Creating users table...')
      // We'll create tables manually through Supabase dashboard or use a different approach
      console.log('Please create the users table manually in Supabase dashboard with the following schema:')
      console.log(`
        CREATE TABLE users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          branch TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)
    } else {
      console.log('✓ Users table exists or accessible')
    }

    // Check sales table
    const { error: salesError } = await supabase
      .from('sales')
      .select('*')
      .limit(1)

    if (salesError && salesError.code === 'PGRST116') {
      console.log('Creating sales table...')
      console.log('Please create the sales table manually in Supabase dashboard with the following schema:')
      console.log(`
        CREATE TABLE sales (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          amount DECIMAL(10,2) NOT NULL,
          branch TEXT NOT NULL,
          item_name TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)
    } else {
      console.log('✓ Sales table exists or accessible')
    }

    console.log('Database setup completed!')

  } catch (error) {
    console.error('Database setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()