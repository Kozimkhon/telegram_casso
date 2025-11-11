/**
 * @fileoverview TypeORM Metric Entity
 * Database entity for statistics and metrics with relationships
 * @module entities/db/Metric
 */

import { EntitySchema } from 'typeorm';

/**
 * Metric TypeORM Entity
 * Represents statistics per session/channel/user combination
 * 
 * Relationships:
 * - Many-to-One with Session (metric tracks session)
 * - Many-to-One with Channel (metric tracks channel)
 * - Many-to-One with User (metric tracks user)
 */
export const MetricEntity = new EntitySchema({
  name: 'Metric',
  tableName: 'metrics',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    messagesSent: {
      name: 'messages_sent',
      type: 'integer',
      default: 0,
      comment: 'Total messages successfully sent',
    },
    messagesFailed: {
      name: 'messages_failed',
      type: 'integer',
      default: 0,
      comment: 'Total messages failed',
    },
    floodErrors: {
      name: 'flood_errors',
      type: 'integer',
      default: 0,
      comment: 'Count of flood wait errors',
    },
    spamWarnings: {
      name: 'spam_warnings',
      type: 'integer',
      default: 0,
      comment: 'Count of spam warnings',
    },
    lastMessageAt: {
      name: 'last_message_at',
      type: 'datetime',
      nullable: true,
      comment: 'Timestamp of last message',
    },
    lastFloodAt: {
      name: 'last_flood_at',
      type: 'datetime',
      nullable: true,
      comment: 'Timestamp of last flood error',
    },
    lastActivity: {
      name: 'last_activity',
      type: 'datetime',
      nullable: true,
      comment: 'Timestamp of last activity',
    },
    channelId: {
      name: 'channel_id',
      type: 'varchar',
      nullable: false,
      comment: 'Channel being tracked',
    },
    userId: {
      name: 'user_id',
      type: 'varchar',
      nullable: false,
      comment: 'User being tracked',
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
   
    // Metric belongs to Channel
    channel: {
      type: 'many-to-one',
      target: 'Channel',
      joinColumn: {
        name: 'channel_id',
        referencedColumnName: 'channelId',
      },
      onDelete: 'CASCADE',
    },
    // Metric belongs to User
    user: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: {
        name: 'user_id',
        referencedColumnName: 'userId',
      },
      onDelete: 'CASCADE',
    },
  },
  indices: [
   
    {
      name: 'IDX_METRIC_CHANNEL',
      columns: ['channelId'],
    },
    {
      name: 'IDX_METRIC_USER',
      columns: ['userId'],
    },
    {
      name: 'IDX_METRIC_COMPOSITE',
      columns: ['channelId', 'userId'],
      unique: true,
    },
  ],
});

export default MetricEntity;
