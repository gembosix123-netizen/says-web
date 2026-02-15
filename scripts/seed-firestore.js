require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_KEY || path.join(__dirname, '../firebase-key.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase Admin SDK key not found at:', serviceAccountPath)
  console.log('💡 Please set FIREBASE_ADMIN_SDK_KEY env var or place firebase-key.json in root')
  process.exit(1)
}

const serviceAccount = require(serviceAccountPath)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

async function seedFirestore() {
  console.log('🔄 Starting Firestore data seeding...\n')

  try {
    // 1. Seed Products
    console.log('📦 Seeding products...')
    const productsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8')
    )

    for (const product of productsData) {
      await db.collection('products').doc(product.id).set({
        ...product,
        isActive: true,
        createdAt: new Date(),
      })
      console.log(`  ✓ ${product.name}`)
    }
    console.log(`✅ Seeded ${productsData.length} products\n`)

    // 2. Seed Users
    console.log('👥 Seeding users...')
    const usersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8')
    )

    for (const user of usersData) {
      await db.collection('users').doc(user.id).set({
        ...user,
        createdAt: new Date(),
      })
      console.log(`  ✓ ${user.username} (${user.role})`)
    }
    console.log(`✅ Seeded ${usersData.length} users\n`)

    // 3. Seed Customers
    console.log('🏪 Seeding customers...')
    const customersData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/customers.json'), 'utf8')
    )

    for (const customer of customersData) {
      await db.collection('customers').doc(customer.id).set({
        ...customer,
        createdAt: new Date(),
      })
      console.log(`  ✓ ${customer.name}`)
    }
    console.log(`✅ Seeded ${customersData.length} customers\n`)

    // 4. Seed Transactions (sample data for testing)
    console.log('💰 Seeding sample transactions...')
    const sampleTransactions = [
      {
        id: 'txn_001',
        customerId: customersData[0]?.id || 'c1',
        amount: 150.50,
        branch: 'Kota Kinabalu',
        salesman: usersData.find(u => u.role === 'Sales')?.username || 'sales_kk',
        date: new Date(),
        items: [{ productId: productsData[0]?.id || 'p1', quantity: 2, price: 75.25 }],
      },
      {
        id: 'txn_002',
        customerId: customersData[1]?.id || 'c2',
        amount: 200.00,
        branch: 'Kinabatangan',
        salesman: usersData.find(u => u.role === 'Sales' && u.branch === 'Kinabatangan')?.username || 'sales_kinabatangan',
        date: new Date(),
        items: [{ productId: productsData[1]?.id || 'p2', quantity: 1, price: 200 }],
      },
    ]

    for (const txn of sampleTransactions) {
      await db.collection('transactions').doc(txn.id).set(txn)
      console.log(`  ✓ Transaction ${txn.id}`)
    }
    console.log(`✅ Seeded ${sampleTransactions.length} transactions\n`)

    console.log('✨ Firestore seeding completed successfully!\n')
    console.log('📊 Summary:')
    console.log(`  - Products: ${productsData.length}`)
    console.log(`  - Users: ${usersData.length}`)
    console.log(`  - Customers: ${customersData.length}`)
    console.log(`  - Transactions: ${sampleTransactions.length}`)
    console.log('\n🎉 All pages should now work properly!')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding Firestore:', error)
    process.exit(1)
  }
}

seedFirestore()
