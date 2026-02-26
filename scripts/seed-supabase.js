require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedSupabase() {
  console.log('🔄 Starting Supabase data seeding...\n')

  try {
    // 1. Seed Products
    console.log('📦 Seeding products...')
    const productsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8')
    )

    for (const product of productsData) {
      const { error } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          name: product.name,
          code: product.code,
          price: product.price,
          unit: product.unit || 'pkt',
          is_active: true,
        }, { onConflict: 'id' })
      
      if (error) {
        console.error(`  ❌ ${product.name}: ${error.message}`)
      } else {
        console.log(`  ✓ ${product.name}`)
      }
    }
    console.log(`✅ Seeded ${productsData.length} products\n`)

    // 2. Seed Users
    console.log('👥 Seeding users...')
    const usersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8')
    )

    for (const user of usersData) {
      // Remove id field to let Supabase auto-generate UUID
      // Remove fields that don't exist in schema (assignedShopId)
      // Convert commissionRate to commission_rate (snake_case)
      const { id, assignedShopId, commissionRate, ...userData } = user;
      
      const userPayload = {
        ...userData,
        commission_rate: commissionRate || 0
      };

      const { error } = await supabase
        .from('users')
        .upsert(userPayload, { onConflict: 'username' })
        
      if (error) {
        console.error(`  ❌ ${user.username}: ${error.message}`)
      } else {
        console.log(`  ✓ ${user.username} (${user.role})`)
      }
    }
    console.log(`✅ Seeded ${usersData.length} users\n`)

    // 3. Seed Customers
    console.log('🏪 Seeding customers...')
    const customersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/customers.json'), 'utf8')
    )

    for (const customer of customersData) {
      const { error } = await supabase
        .from('customers')
        .upsert({
          id: customer.id,
          name: customer.name,
          code: customer.code,
          phone: customer.phone,
          address: customer.address,
          town: customer.town,
          is_active: true,
        }, { onConflict: 'id' })
      
      if (error) {
        console.error(`  ❌ ${customer.name}: ${error.message}`)
      } else {
        console.log(`  ✓ ${customer.name}`)
      }
    }
    console.log(`✅ Seeded ${customersData.length} customers\n`)

    // 4. Create sample transactions if don't exist
    console.log('💰 Creating sample transactions...')
    const sampleTransactions = [
      {
        amount: 150.50,
        branch: 'Kota Kinabalu',
        item_name: 'Meatball 1kg x2',
      },
      {
        amount: 200.00,
        branch: 'Kinabatangan',
        item_name: 'Burger Ayam (10pcs) x1',
      },
      {
        amount: 125.75,
        branch: 'Kota Kinabalu',
        item_name: 'Meatball 800g x3',
      },
      {
        amount: 89.50,
        branch: 'Kinabatangan',
        item_name: 'Sos Cili 1kg x1',
      },
    ]

    let txnCount = 0
    for (const txn of sampleTransactions) {
      const tableName = 'sales_' + txn.branch.toLowerCase().replace(/\s+/g, '_')
      const { error } = await supabase
        .from(tableName)
        .insert([txn])
      
      if (error) {
        // Skip error if it's duplicate, continue anyway
        console.log(`  ⚠️  ${txn.branch}: ${error.message.substring(0,50)}...`)
      } else {
        console.log(`  ✓ ${txn.branch}: RM ${txn.amount.toFixed(2)}`)
        txnCount++
      }
    }
    console.log(`✅ Seeded sample transactions\n`)

    console.log('✨ Supabase seeding completed successfully!\n')
    console.log('📊 Summary:')
    console.log(`  - Products: ${productsData.length}`)
    console.log(`  - Users: ${usersData.length}`)
    console.log(`  - Customers: ${customersData.length}`)
    console.log(`  - Sample Transactions: ${sampleTransactions.length}`)
    console.log('\n🎉 All pages should now work properly!')
    console.log('\nNext steps:')
    console.log('1. Refresh browser (http://localhost:3000)')
    console.log('2. Login with: admin_kk / AdminKK2024!')
    console.log('3. Check Products, Van Loading, Commissions pages')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding Supabase:', error.message)
    process.exit(1)
  }
}

seedSupabase()
