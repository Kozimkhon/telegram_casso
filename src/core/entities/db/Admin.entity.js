/**
 * @fileoverview TypeORM Admin Entity
 * Database entity for admin users with relationships
 * @module entities/db/Admin
 */

import { EntitySchema } from 'typeorm';

/**
 * Admin TypeORM Entity
 * Represents admin users who manage the system
 * 
 * Relationships:
 * - One-to-Many with Session (admin owns multiple sessions)
 * - One-to-Many with Channel (admin manages multiple channels)
 */
export const AdminEntity = new EntitySchema({
  name: 'Admin',
  tableName: 'admins',
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
      nullable: false,
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
      comment: 'Admin phone number for session management',
    },
    role: {
      type: 'varchar',
      default: 'admin',
      comment: 'Admin role: super_admin, admin, moderator',
    },
    isActive: {
      name: 'is_active',
      type: 'boolean',
      default: true,
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
    // Admin has many Sessions
    sessions: {
      type: 'one-to-many',
      target: 'Session',
      inverseSide: 'admin',
      cascade: true,
    },
    // Admin has many Channels
    channels: {
      type: 'one-to-many',
      target: 'Channel',
      inverseSide: 'admin',
      cascade: true,
    },
  },
  indices: [
    {
      name: 'IDX_ADMIN_USER_ID',
      columns: ['userId'],
    },
    {
      name: 'IDX_ADMIN_PHONE',
      columns: ['phone'],
    },
  ],
});

export default AdminEntity;
