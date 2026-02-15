const fs = require('fs');
const path = require('path');

// Create users data with plain text passwords for testing
const users = [
  {
    "id": "u_founder",
    "username": "founder",
    "password": "Founder2024!",
    "role": "Founder",
    "name": "Founder",
    "assignedShopId": null,
    "branch": "HQ"
  },
  {
    "id": "u_admin_kk",
    "username": "admin_kk",
    "password": "AdminKK2024!",
    "role": "Admin",
    "name": "Admin Kota Kinabalu",
    "assignedShopId": null,
    "branch": "Kota Kinabalu"
  },
  {
    "id": "u_admin_kinabatangan",
    "username": "admin_kinabatangan",
    "password": "AdminKB2024!",
    "role": "Admin",
    "name": "Admin Kinabatangan",
    "assignedShopId": null,
    "branch": "Kinabatangan"
  },
  {
    "id": "u_sales_kk",
    "username": "sales_kk",
    "password": "SalesKK2024!",
    "role": "Sales",
    "name": "Sales Kota Kinabalu",
    "commissionRate": 0.04,
    "branch": "Kota Kinabalu"
  },
  {
    "id": "u_sales_kinabatangan",
    "username": "sales_kinabatangan",
    "password": "SalesKB2024!",
    "role": "Sales",
    "name": "KinabOIUYGFDSDFGHJKL;atangan",
    "commissionRate": 0.04,
    "branch": "Kinabatangan"
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