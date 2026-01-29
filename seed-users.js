const fs = require('fs');
const path = require('path');

// Create users data with plain text passwords for testing
const users = [
  {
    "id": "u2",
    "username": "sales1",
    "password": "password",
    "role": "Sales",
    "name": "Sales Ali",
    "commissionRate": 0.04
  },
  {
    "id": "u3",
    "username": "allan",
    "password": "Allan123",
    "role": "Sales",
    "name": "Allan"
  },
  {
    "id": "u1769659646010",
    "username": "admin",
    "password": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    "role": "Admin",
    "name": "admn kk",
    "assignedShopId": null,
    "branch": "HQ"
  }
];

// Write to data/users.json
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const usersPath = path.join(dataDir, 'users.json');
fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

console.log('✅ Users seeded successfully!');
console.log('Login credentials:');
console.log('- sales1 / password (Kota Kinabalu)');
console.log('- allan / Allan123 (Kinabatangan)');
console.log('- admin / [encrypted] (Admin)');