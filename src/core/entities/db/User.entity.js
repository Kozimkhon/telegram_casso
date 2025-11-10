/**
 * @fileoverview TypeORM User Entity
 * Database entity for Telegram users (recipients) with relationships
 * @module entities/db/User
 */

import { EntitySchema } from 'typeorm';

/**
 * User TypeORM Entity
 * Represents regular Telegram users who receive messages
 * 
 * Relationships:
 * - Many-to-Many with Channel (users belong to channels)
 * - One-to-Many with Message (user receives messages)
 * - One-to-Many with Metric (user has metrics)
 */
export const UserEntity = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    userId: {
      name: 'user_id',
      type: 'varchar',
      unique: true,
      nullable: false,
      comment: 'Telegram user ID',
    },
    firstName: {
      name: 'first_name',
      type: 'varchar',
      nullable: true,
    },
    lastName: {
      name: 'last_name',
      type: 'varchar',
      nullable: true,
    },
    username: {
      type: 'varchar',
      nullable: true,
    },
    phone: {
      type: 'varchar',
      nullable: true,
    },
    isBot: {
      name: 'is_bot',
      type: 'boolean',
      default: false,
    },
    isActive: {
      name: 'is_active',
      type: 'boolean',
      default: true,
      comment: 'Whether user is active and can receive messages',
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
    // User belongs to many Channels
    channels: {
      type: 'many-to-many',
      target: 'Channel',
      inverseSide: 'users',
    },
    // User receives many Messages
    messages: {
      type: 'one-to-many',
      target: 'Message',
      inverseSide: 'user',
      cascade: true,
    },
    // User has many Metrics
    metrics: {
      type: 'one-to-many',
      target: 'Metric',
      inverseSide: 'user',
      cascade: true,
    },
  },
  indices: [
    {
      name: 'IDX_USER_ID',
      columns: ['userId'],
    },
    {
      name: 'IDX_USER_USERNAME',
      columns: ['username'],
    },
    {
      name: 'IDX_USER_ACTIVE',
      columns: ['isActive'],
    },
  ],
});

export default UserEntity;
