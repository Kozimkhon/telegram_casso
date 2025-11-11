/**
 * @fileoverview TypeORM Channel Entity
 * Database entity for Telegram channels with relationships
 * @module entities/db/Channel
 */

import { EntitySchema } from 'typeorm';

/**
 * Channel TypeORM Entity
 * Represents Telegram channels being monitored
 * 
 * Relationships:
 * - Many-to-One with Admin (channel belongs to admin)
 * - Many-to-One with Session (channel uses session)
 * - Many-to-Many with User (channel has members)
 * - One-to-Many with Message (channel has messages)
 * - One-to-Many with Metric (channel has metrics)
 */
export const ChannelEntity = new EntitySchema({
  name: 'Channel',
  tableName: 'channels',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    channelId: {
      name: 'channel_id',
      type: 'varchar',
      unique: true,
      nullable: false,
      comment: 'Telegram channel ID',
    },
    title: {
      type: 'varchar',
      nullable: false,
    },
    forwardEnabled: {
      name: 'forward_enabled',
      type: 'boolean',
      default: true,
      comment: 'Whether forwarding is enabled for this channel',
    },
    // Throttling settings
    throttleDelayMs: {
      name: 'throttle_delay_ms',
      type: 'integer',
      default: 1000,
      comment: 'Base delay between forwards (ms)',
    },
    throttlePerMemberMs: {
      name: 'throttle_per_member_ms',
      type: 'integer',
      default: 500,
      comment: 'Additional delay per member (ms)',
    },
    minDelayMs: {
      name: 'min_delay_ms',
      type: 'integer',
      default: 2000,
      comment: 'Minimum delay between forwards (ms)',
    },
    maxDelayMs: {
      name: 'max_delay_ms',
      type: 'integer',
      default: 5000,
      comment: 'Maximum delay between forwards (ms)',
    },
    // Scheduling settings
    scheduleEnabled: {
      name: 'schedule_enabled',
      type: 'boolean',
      default: false,
      comment: 'Whether scheduling is enabled',
    },
    scheduleConfig: {
      name: 'schedule_config',
      type: 'text',
      nullable: true,
      comment: 'JSON schedule configuration',
    },
    // Foreign keys
    adminUserId: {
      name: 'admin_user_id',
      type: 'varchar',
      nullable: true,
      comment: 'Admin who manages this channel',
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
    // Channel belongs to Admin
    admin: {
      type: 'many-to-one',
      target: 'Admin',
      joinColumn: {
        name: 'admin_user_id',
        referencedColumnName: 'userId',
      },
      onDelete: 'SET NULL',
      nullable: true,
    },
    // Channel has many Users (members)
    users: {
      type: 'many-to-many',
      target: 'User',
      joinTable: {
        name: 'channel_members',
        joinColumn: {
          name: 'channel_id',
          referencedColumnName: 'channelId',
        },
        inverseJoinColumn: {
          name: 'user_id',
          referencedColumnName: 'userId',
        },
      },
      cascade: true,
    },
    // Channel has many Messages
    messages: {
      type: 'one-to-many',
      target: 'Message',
      inverseSide: 'channel',
      cascade: true,
    },
    // Channel has many Metrics
    metrics: {
      type: 'one-to-many',
      target: 'Metric',
      inverseSide: 'channel',
      cascade: true,
    },
  },
  indices: [
    {
      name: 'IDX_CHANNEL_ID',
      columns: ['channelId'],
    },
    {
      name: 'IDX_CHANNEL_ADMIN',
      columns: ['adminUserId'],
    },
    {
      name: 'IDX_CHANNEL_FORWARD_ENABLED',
      columns: ['forwardEnabled'],
    },
  ],
});

export default ChannelEntity;
