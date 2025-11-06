#!/usr/bin/env node
/**
 * Script to add a new userbot session to the database
 * Usage: npm run sessions:add
 */

import { initializeDatabase, closeDatabase } from '../src/db/db.js';
import { saveSession } from '../src/services/sessionService.js';
import inquirer from 'inquirer';

async function addSession() {
  try {
    console.log('🔐 Adding New UserBot Session\n');
    
    // Initialize database
    await initializeDatabase();
    
    // Get session details from user
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'phone',
        message: 'Enter phone number (international format, e.g., +1234567890):',
        validate: (input) => {
          if (!input.startsWith('+') || input.length < 10) {
            return 'Please enter a valid phone number in international format';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'userId',
        message: 'Enter Telegram User ID (optional, leave empty if unknown):',
        default: ''
      },
      {
        type: 'list',
        name: 'status',
        message: 'Select initial status:',
        choices: [
          { name: 'Active - Ready to use', value: 'active' },
          { name: 'Paused - Temporarily disabled', value: 'paused' }
        ],
        default: 'active'
      }
    ]);
    
    // Create session data
    const sessionData = {
      phone: answers.phone,
      userId: answers.userId || null,
      sessionString: null, // Will be set during first connection
      status: answers.status,
      firstName: null,
      lastName: null,
      username: null
    };
    
    // Save to database
    await saveSession(sessionData);
    
    console.log('✅ Session added successfully!');
    console.log(`📱 Phone: ${sessionData.phone}`);
    console.log(`📊 Status: ${sessionData.status}`);
    console.log('\n💡 Tips:');
    console.log('- The session will be authenticated on first startup');
    console.log('- Use AdminBot /sessions command to manage sessions');
    console.log('- Restart the application to load the new session');
    
  } catch (error) {
    console.error('❌ Error adding session:', error.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addSession().catch(console.error);
}

export default addSession;