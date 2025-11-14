/**
 * @fileoverview TypeORM ChannelLog Entity
 * Database entity for Telegram channel admin log events
 * @module entities/orm/ChannelLog
 */

import { EntitySchema } from 'typeorm';

/**
 * ChannelLog TypeORM Entity
 * Stores admin log events from Telegram channels for analytics and monitoring
 * 
 * Relationships:
 * - Many-to-One with Channel (log belongs to a channel)
 * 
 * Log Events Tracked:
 * - channelAdminLogEventActionParticipantJoin - User joined channel
 * - channelAdminLogEventActionParticipantLeave - User left channel
 * - channelAdminLogEventActionParticipantInvite - User was invited
 * - channelAdminLogEventActionParticipantToggleBan - User was banned/unbanned
 * - channelAdminLogEventActionParticipantJoinByInvite - User joined by invite link
 * - channelAdminLogEventActionParticipantJoinByRequest - User joined by request approval
 * 
 * @see https://core.telegram.org/method/channels.getAdminLog
 * @see https://core.telegram.org/constructor/channelAdminLogEvent
 * @see https://core.telegram.org/type/ChannelAdminLogEventAction
 */
export const ChannelLogEntity = new EntitySchema({
  name: 'ChannelLog',
  tableName: 'channel_logs',
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      comment: 'Admin log event ID from Telegram',
    },
    channelId: {
      name: 'channel_id',
      type: 'integer',
      nullable: false,
      comment: 'Reference to channels table',
    },
    date: {
      type: 'integer',
      nullable: false,
      comment: 'Unix timestamp of the event',
    },
    userId: {
      name: 'user_id',
      type: 'bigint',
      nullable: false,
      comment: 'Telegram user ID who performed the action',
    },
    action: {
      type: 'json',
      nullable: false,
      comment: 'JSON representation of ChannelAdminLogEventAction',
    },
    createdAt: {
      name: 'created_at',
      type: 'datetime',
      createDate: true,
      comment: 'When this log was stored in our database',
    },
  },
  relations: {
    // ChannelLog belongs to Channel
    channel: {
      type: 'many-to-one',
      target: 'Channel',
      joinColumn: {
        name: 'channel_id',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
      nullable: false,
    },
  },
  indices: [
    {
      name: 'IDX_CHANNEL_LOG_CHANNEL_ID',
      columns: ['channelId'],
    },
    {
      name: 'IDX_CHANNEL_LOG_DATE',
      columns: ['date'],
    },
    {
      name: 'IDX_CHANNEL_LOG_USER_ID',
      columns: ['userId'],
    },
    {
      name: 'IDX_CHANNEL_LOG_CHANNEL_DATE',
      columns: ['channelId', 'date'],
    },
  ],
});

export default ChannelLogEntity;
