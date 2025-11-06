#!/usr/bin/env node
/**
 * Add First Admin Script
 * Adds the first admin user to the database so they can access the AdminBot
 * Usage: node scripts/addFirstAdmin.js <user_id> <first_name> [username]
 */

import { getDatabase, initializeDatabase } from '../src/db/db.js';
import { addAdmin } from '../src/services/adminService.js';

async function addFirstAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node scripts/addFirstAdmin.js <user_id> <first_name> [username]

Example:
  node scripts/addFirstAdmin.js 123456789 "John Doe" "johndoe"

To find your Telegram user ID:
  1. Send a message to @userinfobot
  2. Or send any message to your AdminBot and check the logs
`);
    process.exit(1);
  }

  const [userId, firstName, username] = args;

  try {
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database connected');

    // Add admin user
    const success = await addAdmin({
      user_id: userId,
      first_name: firstName,
      last_name: null,
      username: username || null,
      role: 'admin'
    });

    if (success) {
      console.log(`✅ Admin user added successfully!`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Name: ${firstName}`);
      console.log(`   Username: ${username || 'N/A'}`);
      console.log(`   Role: admin`);
      console.log(`\nYou can now send /start to your AdminBot to access the system.`);
    } else {
      console.log('❌ Failed to add admin user');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

addFirstAdmin();