/**
 * @fileoverview TypeORM Session Entity
 * Database entity for UserBot sessions with relationships
 * @module entities/db/Session
 */

import { EntitySchema } from 'typeorm';

/**
 * Session TypeORM Entity
 * Represents UserBot sessions for Telegram automation
 * 
 * Relationships:
 * - Many-to-One with Admin (session belongs to admin)
 * - One-to-Many with Channel (session can manage multiple channels)
 * - One-to-Many with Message (session sends messages)
 * - One-to-Many with Metric (session has metrics)
 */
export const SessionEntity = new EntitySchema({
  name: 'Session',
  tableName: 'sessions',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    // Foreign key to Admin (user info including phone stored in Admin table)
    adminId: {
      name: 'admin_id',
      type: 'varchar',
      unique: true,
      nullable: false,
      comment: 'Admin user ID who owns this session (one-to-one)',
    },
    sessionString: {
      name: 'session_string',
      type: 'text',
      nullable: true,
      comment: 'Encrypted session string',
    },
    status: {
      type: 'varchar',
      default: 'active',
      comment: 'Status: active, paused, error, deleted',
    },
    autoPaused: {
      name: 'auto_paused',
      type: 'boolean',
      default: false,
      comment: 'Whether session was auto-paused by system',
    },
    pauseReason: {
      name: 'pause_reason',
      type: 'text',
      nullable: true,
    },
    floodWaitUntil: {
      name: 'flood_wait_until',
      type: 'datetime',
      nullable: true,
      comment: 'When flood wait expires',
    },
    lastError: {
      name: 'last_error',
      type: 'text',
      nullable: true,
    },
    lastActive: {
      name: 'last_active',
      type: 'datetime',
      nullable: true,
    },
    
    createdAt: {
      name: 'created_at',
      type: 'datetime',
      createDate: true,
    },
    updatedAt: {
      name: 'updated_at',
      type: 'datetime',
      updateDate: true,
    },
  },
  relations: {
    // Session belongs to Admin
    admin: {
      type: 'many-to-one',
      target: 'Admin',
      joinColumn: {
        name: 'admin_id',
        referencedColumnName: 'userId',
      },
      onDelete: 'CASCADE',
      nullable: false,
    },
    // Session has many Messages
    messages: {
      type: 'one-to-many',
      target: 'Message',
      inverseSide: 'session',
      cascade: true,
    },
    // Session has many Metrics
    metrics: {
      type: 'one-to-many',
      target: 'Metric',
      inverseSide: 'session',
      cascade: true,
    },
  },
  indices: [
    {
      name: 'IDX_SESSION_ADMIN',
      columns: ['adminId'],
    },
    {
      name: 'IDX_SESSION_STATUS',
      columns: ['status'],
    },
  ],
});

export default SessionEntity;
