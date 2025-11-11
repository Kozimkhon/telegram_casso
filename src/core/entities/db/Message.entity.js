/**
 * @fileoverview TypeORM Message Entity
 * Database entity for message forwarding logs with relationships
 * @module entities/db/Message
 */

import { EntitySchema } from 'typeorm';

/**
 * Message TypeORM Entity
 * Represents forwarded messages with tracking information
 * 
 * Relationships:
 * - Many-to-One with Session (message sent via session)
 * - Many-to-One with Channel (message from channel)
 * - Many-to-One with User (message sent to user)
 * - One-to-One with Metric (message generates metric)
 */
export const MessageEntity = new EntitySchema({
  name: 'Message',
  tableName: 'messages',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    messageId: {
      name: 'message_id',
      type: 'varchar',
      nullable: false,
      comment: 'Original message ID from channel',
    },
    forwardedMessageId: {
      name: 'forwarded_message_id',
      type: 'varchar',
      nullable: true,
      comment: 'ID of forwarded message',
    },
    status: {
      type: 'varchar',
      nullable: false,
      default: 'pending',
      comment: 'Status: pending, sent, failed, deleted',
    },
    errorMessage: {
      name: 'error_message',
      type: 'text',
      nullable: true,
    },
    retryCount: {
      name: 'retry_count',
      type: 'integer',
      default: 0,
    },
    channelId: {
      name: 'channel_id',
      type: 'varchar',
      nullable: false,
      comment: 'Channel where message originated',
    },
    userId: {
      name: 'user_id',
      type: 'varchar',
      nullable: false,
      comment: 'User who received message',
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
   
    // Message belongs to Channel
    channel: {
      type: 'many-to-one',
      target: 'Channel',
      joinColumn: {
        name: 'channel_id',
        referencedColumnName: 'channelId',
      },
      onDelete: 'CASCADE',
    },
    // Message belongs to User
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
      name: 'IDX_MESSAGE_STATUS',
      columns: ['status'],
    },
    {
      name: 'IDX_MESSAGE_CHANNEL',
      columns: ['channelId'],
    },
    {
      name: 'IDX_MESSAGE_USER',
      columns: ['userId'],
    },
    {
      name: 'IDX_MESSAGE_CREATED',
      columns: ['createdAt'],
    },
  ],
});

export default MessageEntity;
