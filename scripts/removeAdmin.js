#!/usr/bin/env node

/**
 * Script to remove an admin from the database
 */

import { initializeDatabase } from '../src/db/db.js';
import { removeAdmin } from '../src/services/adminService.js';

const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node scripts/removeAdmin.js <user_id>');
  process.exit(1);
}

try {
  await initializeDatabase();
  console.log('✓ Database connected');
  
  const success = await removeAdmin(parseInt(userId));
  
  if (success) {
    console.log(`✅ Admin with user ID ${userId} removed successfully`);
  } else {
    console.log(`❌ Admin with user ID ${userId} not found or already removed`);
  }
  
} catch (error) {
  console.error('❌ Error removing admin:', error.message);
  process.exit(1);
}