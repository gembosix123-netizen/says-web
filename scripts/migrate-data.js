require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateData() {
  console.log('Starting data migration to Supabase...')

  try {
    // 1. Migrate users
    console.log('Migrating users...')
    const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8'))
    
    for (const user of usersData) {
      const { error } = await supabase
        .from('users')
        .upsert({
          // Don't include id, let Supabase generate UUID
          name: user.name,
          username: user.username,
          password: user.password,
          role: user.role,
          branch: user.branch
        })
      
      if (error) {
        console.error(`Error migrating user ${user.username}:`, error)
      } else {
        console.log(`✓ Migrated user: ${user.username}`)
      }
    }

    // 2. Create dummy sales data (RM 488.50, 4 transactions)
    console.log('Creating dummy sales data...')
    const dummySales = [
      {
        amount: 122.13,
        branch: 'Kota Kinabalu',
        item_name: 'Product Bundle A',
        created_at: new Date().toISOString()
      },
      {
        amount: 156.75,
        branch: 'Kota Kinabalu', 
        item_name: 'Product Bundle B',
        created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        amount: 89.32,
        branch: 'Kinabatangan',
        item_name: 'Product Bundle C',
        created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      },
      {
        amount: 120.30,
        branch: 'Kinabatangan',
        item_name: 'Product Bundle D',
        created_at: new Date(Date.now() - 10800000).toISOString() // 3 hours ago
      }
    ]

    for (const sale of dummySales) {
      const { error } = await supabase
        .from('sales')
        .insert(sale)
      
      if (error) {
        console.error('Error creating sale:', error)
      } else {
        console.log(`✓ Created sale: ${sale.item_name} - RM ${sale.amount}`)
      }
    }

    // Verify total
    const { data: allSales } = await supabase
      .from('sales')
      .select('amount')
    
    const total = allSales?.reduce((sum, sale) => sum + parseFloat(sale.amount), 0) || 0
    console.log(`\n✓ Migration completed! Total sales: RM ${total.toFixed(2)}`)

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrateData()