#!/usr/bin/env node
/**
 * Script to list all userbot sessions in the database
 * Usage: npm run sessions:list
 */

import { initializeDatabase, closeDatabase } from '../src/db/db.js';
import { getAllSessions } from '../src/services/sessionService.js';

async function listSessions() {
  try {
    console.log('🔐 UserBot Sessions List\n');
    
    // Initialize database
    await initializeDatabase();
    
    // Get all sessions
    const sessions = await getAllSessions();
    
    if (sessions.length === 0) {
      console.log('📋 No sessions found in database');
      console.log('\n💡 Add a session with: npm run sessions:add');
      return;
    }
    
    console.log(`📊 Total Sessions: ${sessions.length}\n`);
    
    // Display sessions
    sessions.forEach((session, index) => {
      const statusEmoji = {
        'active': '✅',
        'paused': '⏸️',
        'error': '❌'
      }[session.status] || '❓';
      
      console.log(`${index + 1}. ${statusEmoji} ${session.phone}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   User ID: ${session.user_id || 'Not set'}`);
      console.log(`   Name: ${session.first_name || 'Unknown'} ${session.last_name || ''}`);
      console.log(`   Username: ${session.username || 'Not set'}`);
      
      if (session.auto_paused) {
        console.log(`   Auto-paused: Yes (${session.pause_reason})`);
      }
      
      if (session.flood_wait_until) {
        const waitUntil = new Date(session.flood_wait_until);
        const now = new Date();
        if (waitUntil > now) {
          const waitMinutes = Math.ceil((waitUntil - now) / 60000);
          console.log(`   Flood wait: ${waitMinutes} minutes remaining`);
        }
      }
      
      if (session.last_active) {
        const lastActive = new Date(session.last_active);
        console.log(`   Last active: ${lastActive.toLocaleString()}`);
      }
      
      console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
      console.log(''); // Empty line
    });
    
    // Summary statistics
    const statusCounts = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📈 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji = {
        'active': '✅',
        'paused': '⏸️',
        'error': '❌'
      }[status] || '❓';
      console.log(`   ${emoji} ${status}: ${count}`);
    });
    
    console.log('\n💡 Management Tips:');
    console.log('- Use AdminBot /sessions to manage sessions interactively');
    console.log('- Paused sessions can be resumed via AdminBot');
    console.log('- Error sessions may need manual intervention');
    console.log('- Check logs for detailed session information');
    
  } catch (error) {
    console.error('❌ Error listing sessions:', error.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  listSessions().catch(console.error);
}

export default listSessions;