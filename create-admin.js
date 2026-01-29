const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Hash password using SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createAdminUser() {
  try {
    console.log('Updating local users.json file...');
    
    const usersFilePath = path.join(__dirname, 'data', 'users.json');
    
    // Read existing users from JSON file
    let users = [];
    if (fs.existsSync(usersFilePath)) {
      const fileContent = fs.readFileSync(usersFilePath, 'utf8');
      users = JSON.parse(fileContent);
    }
    
    console.log('Current users:', users);
    
    // Hash the admin password
    const hashedPassword = hashPassword('admin123');
    
    // Check if admin user already exists
    const adminExists = users.find(u => u.username === 'admin');
    
    if (adminExists) {
      console.log('Admin user already exists. Updating password...');
      // Update existing admin user
      users = users.map(u => 
        u.username === 'admin' 
          ? { ...u, password: hashedPassword }
          : u
      );
    } else {
      console.log('Creating new admin user...');
      // Create new admin user
      const newAdmin = {
        id: 'admin_' + Date.now(),
        username: 'admin',
        password: hashedPassword,
        role: 'Admin',
        name: 'Administrator',
        branch: 'HQ'
      };
      users.push(newAdmin);
    }
    
    // Save to local JSON file
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    console.log('✅ Admin user created/updated successfully in users.json!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Hashed Password:', hashedPassword);
    
    // Verify by reading back
    const verifyUsers = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    const adminUser = verifyUsers.find(u => u.username === 'admin');
    console.log('\nVerification - Admin user details:', adminUser);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser();
