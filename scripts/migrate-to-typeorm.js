/**
 * @fileoverview Data Migration Script
 * Migrates data from old SQLite schema to TypeORM
 * @module scripts/migrate-to-typeorm
 */

import 'reflect-metadata';
import { initializeDatabase, getAllQuery, closeDatabase } from '../src/db/db.js';
import { initializeTypeORM, closeTypeORM } from '../src/config/database.js';
import RepositoryFactory from '../src/data/repositories/RepositoryFactory.js';

/**
 * Data Migration Class
 * Migrates data from old schema to TypeORM
 */
class DataMigration {
  constructor() {
    this.stats = {
      admins: { migrated: 0, skipped: 0, errors: 0 },
      sessions: { migrated: 0, skipped: 0, errors: 0 },
      channels: { migrated: 0, skipped: 0, errors: 0 },
      users: { migrated: 0, skipped: 0, errors: 0 },
      channelMembers: { migrated: 0, skipped: 0, errors: 0 },
      messages: { migrated: 0, skipped: 0, errors: 0 },
      metrics: { migrated: 0, skipped: 0, errors: 0 },
    };
  }

  /**
   * Main migration function
   */
  async migrate() {
    try {
      console.log('🚀 Starting data migration from old schema to TypeORM...\n');

      // Initialize both databases
      console.log('📦 Initializing databases...');
      await initializeDatabase();
      console.log('✅ Old SQLite database connected');
      
      await initializeTypeORM();
      console.log('✅ TypeORM initialized\n');

      // Get repositories
      const adminRepo = RepositoryFactory.getAdminRepository();
      const sessionRepo = RepositoryFactory.getSessionRepository();
      const channelRepo = RepositoryFactory.getChannelRepository();
      const userRepo = RepositoryFactory.getUserRepository();
      const messageRepo = RepositoryFactory.getMessageRepository();
      const metricRepo = RepositoryFactory.getMetricRepository();

      // Migrate admins
      console.log('👤 Migrating admins...');
      await this.migrateAdmins(adminRepo);

      // Migrate sessions
      console.log('📱 Migrating sessions...');
      await this.migrateSessions(sessionRepo);

      // Migrate users first (needed for channel members)
      console.log('👥 Migrating users...');
      await this.migrateUsers(userRepo);

      // Migrate channels
      console.log('📢 Migrating channels...');
      await this.migrateChannels(channelRepo);

      // Migrate channel members
      console.log('🔗 Migrating channel members...');
      await this.migrateChannelMembers(channelRepo);

      // Migrate message logs
      console.log('📨 Migrating message logs...');
      await this.migrateMessages(messageRepo);

      // Migrate metrics
      console.log('📊 Migrating metrics...');
      await this.migrateMetrics(metricRepo);

      // Print summary
      this.printSummary();

      console.log('\n✅ Migration completed successfully!\n');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      // Close connections
      await closeDatabase();
      await closeTypeORM();
      console.log('👋 Database connections closed');
    }
  }

  /**
   * Migrates admins
   */
  async migrateAdmins(adminRepo) {
    try {
      const oldAdmins = await getAllQuery('SELECT * FROM admins', []);
      
      for (const oldAdmin of oldAdmins) {
        try {
          // Check if already exists
          const exists = await adminRepo.findByUserId(oldAdmin.user_id);
          
          if (exists) {
            this.stats.admins.skipped++;
            continue;
          }

          // Create new admin
          await adminRepo.create({
            userId: oldAdmin.user_id,
            firstName: oldAdmin.first_name,
            lastName: oldAdmin.last_name,
            username: oldAdmin.username,
            phone: oldAdmin.phone,
            role: oldAdmin.role || 'admin',
            isActive: Boolean(oldAdmin.is_active),
            createdAt: oldAdmin.created_at ? new Date(oldAdmin.created_at) : new Date(),
            updatedAt: oldAdmin.updated_at ? new Date(oldAdmin.updated_at) : new Date(),
          });

          this.stats.admins.migrated++;
        } catch (error) {
          console.error(`   ❌ Error migrating admin ${oldAdmin.user_id}:`, error.message);
          this.stats.admins.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.admins.migrated}, Skipped: ${this.stats.admins.skipped}, Errors: ${this.stats.admins.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate admins:', error.message);
    }
  }

  /**
   * Migrates sessions
   */
  async migrateSessions(sessionRepo) {
    try {
      const oldSessions = await getAllQuery('SELECT * FROM sessions', []);
      
      for (const oldSession of oldSessions) {
        try {
          // Check if already exists
          const exists = await sessionRepo.findByPhone(oldSession.phone);
          
          if (exists) {
            this.stats.sessions.skipped++;
            continue;
          }

          // Create new session
          await sessionRepo.create({
            phone: oldSession.phone,
            userId: oldSession.user_id,
            sessionString: oldSession.session_string,
            status: oldSession.status || 'active',
            firstName: oldSession.first_name,
            lastName: oldSession.last_name,
            username: oldSession.username,
            autoPaused: Boolean(oldSession.auto_paused),
            pauseReason: oldSession.pause_reason,
            floodWaitUntil: oldSession.flood_wait_until ? new Date(oldSession.flood_wait_until) : null,
            lastError: oldSession.last_error,
            lastActive: oldSession.last_active ? new Date(oldSession.last_active) : new Date(),
            adminUserId: oldSession.admin_user_id || null,
            createdAt: oldSession.created_at ? new Date(oldSession.created_at) : new Date(),
            updatedAt: oldSession.updated_at ? new Date(oldSession.updated_at) : new Date(),
          });

          this.stats.sessions.migrated++;
        } catch (error) {
          console.error(`   ❌ Error migrating session ${oldSession.phone}:`, error.message);
          this.stats.sessions.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.sessions.migrated}, Skipped: ${this.stats.sessions.skipped}, Errors: ${this.stats.sessions.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate sessions:', error.message);
    }
  }

  /**
   * Migrates users
   */
  async migrateUsers(userRepo) {
    try {
      const oldUsers = await getAllQuery('SELECT * FROM users', []);
      
      for (const oldUser of oldUsers) {
        try {
          // Check if already exists
          const exists = await userRepo.findByUserId(oldUser.user_id);
          
          if (exists) {
            this.stats.users.skipped++;
            continue;
          }

          // Create new user
          await userRepo.create({
            userId: oldUser.user_id,
            firstName: oldUser.first_name,
            lastName: oldUser.last_name,
            username: oldUser.username,
            phone: oldUser.phone,
            isBot: false,
            isActive: true,
            createdAt: oldUser.created_at ? new Date(oldUser.created_at) : new Date(),
            updatedAt: oldUser.updated_at ? new Date(oldUser.updated_at) : new Date(),
          });

          this.stats.users.migrated++;
        } catch (error) {
          console.error(`   ❌ Error migrating user ${oldUser.user_id}:`, error.message);
          this.stats.users.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.users.migrated}, Skipped: ${this.stats.users.skipped}, Errors: ${this.stats.users.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate users:', error.message);
    }
  }

  /**
   * Migrates channels
   */
  async migrateChannels(channelRepo) {
    try {
      const oldChannels = await getAllQuery('SELECT * FROM channels', []);
      
      for (const oldChannel of oldChannels) {
        try {
          // Check if already exists
          const exists = await channelRepo.findByChannelId(oldChannel.channel_id);
          
          if (exists) {
            this.stats.channels.skipped++;
            continue;
          }

          // Create new channel
          await channelRepo.create({
            channelId: oldChannel.channel_id,
            title: oldChannel.title,
            forwardEnabled: Boolean(oldChannel.forward_enabled),
            sessionPhone: oldChannel.admin_session_phone,
            adminUserId: null, // Will be linked separately if needed
            throttleDelayMs: oldChannel.throttle_delay_ms || 1000,
            throttlePerMemberMs: oldChannel.throttle_per_member_ms || 500,
            minDelayMs: oldChannel.min_delay_ms || 2000,
            maxDelayMs: oldChannel.max_delay_ms || 5000,
            scheduleEnabled: Boolean(oldChannel.schedule_enabled),
            scheduleConfig: oldChannel.schedule_config,
            createdAt: oldChannel.created_at ? new Date(oldChannel.created_at) : new Date(),
            updatedAt: oldChannel.updated_at ? new Date(oldChannel.updated_at) : new Date(),
          });

          this.stats.channels.migrated++;
        } catch (error) {
          console.error(`   ❌ Error migrating channel ${oldChannel.channel_id}:`, error.message);
          this.stats.channels.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.channels.migrated}, Skipped: ${this.stats.channels.skipped}, Errors: ${this.stats.channels.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate channels:', error.message);
    }
  }

  /**
   * Migrates channel members
   */
  async migrateChannelMembers(channelRepo) {
    try {
      const oldMembers = await getAllQuery('SELECT * FROM channel_members', []);
      
      for (const member of oldMembers) {
        try {
          await channelRepo.addUser(member.channel_id, member.user_id);
          this.stats.channelMembers.migrated++;
        } catch (error) {
          // Might fail if relationship already exists, which is fine
          this.stats.channelMembers.skipped++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.channelMembers.migrated}, Skipped: ${this.stats.channelMembers.skipped}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate channel members:', error.message);
    }
  }

  /**
   * Migrates message logs
   */
  async migrateMessages(messageRepo) {
    try {
      const oldMessages = await getAllQuery('SELECT * FROM message_logs', []);
      
      for (const oldMessage of oldMessages) {
        try {
          await messageRepo.create({
            messageId: oldMessage.message_id,
            forwardedMessageId: oldMessage.forwarded_message_id,
            channelId: oldMessage.channel_id,
            userId: oldMessage.user_id,
            sessionPhone: oldMessage.session_phone,
            status: oldMessage.status || 'pending',
            errorMessage: oldMessage.error_message,
            retryCount: oldMessage.retry_count || 0,
            createdAt: oldMessage.created_at ? new Date(oldMessage.created_at) : new Date(),
            updatedAt: oldMessage.updated_at ? new Date(oldMessage.updated_at) : new Date(),
          });

          this.stats.messages.migrated++;
        } catch (error) {
          this.stats.messages.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.messages.migrated}, Errors: ${this.stats.messages.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate messages:', error.message);
    }
  }

  /**
   * Migrates metrics
   */
  async migrateMetrics(metricRepo) {
    try {
      const oldMetrics = await getAllQuery('SELECT * FROM metrics', []);
      
      for (const oldMetric of oldMetrics) {
        try {
          await metricRepo.create({
            sessionPhone: oldMetric.session_phone,
            channelId: oldMetric.channel_id,
            userId: oldMetric.user_id,
            messagesSent: oldMetric.messages_sent || 0,
            messagesFailed: oldMetric.messages_failed || 0,
            floodErrors: oldMetric.flood_errors || 0,
            spamWarnings: oldMetric.spam_warnings || 0,
            lastMessageAt: oldMetric.last_message_at ? new Date(oldMetric.last_message_at) : null,
            lastFloodAt: oldMetric.last_flood_at ? new Date(oldMetric.last_flood_at) : null,
            lastActivity: oldMetric.last_activity ? new Date(oldMetric.last_activity) : null,
            createdAt: oldMetric.created_at ? new Date(oldMetric.created_at) : new Date(),
            updatedAt: oldMetric.updated_at ? new Date(oldMetric.updated_at) : new Date(),
          });

          this.stats.metrics.migrated++;
        } catch (error) {
          this.stats.metrics.errors++;
        }
      }

      console.log(`   ✅ Migrated: ${this.stats.metrics.migrated}, Errors: ${this.stats.metrics.errors}`);
    } catch (error) {
      console.error('   ❌ Failed to migrate metrics:', error.message);
    }
  }

  /**
   * Prints migration summary
   */
  printSummary() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('═'.repeat(60));
    
    const entities = ['admins', 'sessions', 'channels', 'users', 'channelMembers', 'messages', 'metrics'];
    
    for (const entity of entities) {
      const stats = this.stats[entity];
      const total = stats.migrated + stats.skipped + stats.errors;
      console.log(`\n${entity.toUpperCase()}:`);
      console.log(`  Total: ${total}`);
      console.log(`  ✅ Migrated: ${stats.migrated}`);
      console.log(`  ⏭️  Skipped: ${stats.skipped}`);
      console.log(`  ❌ Errors: ${stats.errors}`);
    }
    
    console.log('\n' + '═'.repeat(60));
  }
}

// Run migration
const migration = new DataMigration();
migration.migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
