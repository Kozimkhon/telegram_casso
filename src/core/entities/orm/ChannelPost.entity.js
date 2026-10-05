/**
 * @fileoverview TypeORM ChannelPost Entity
 * Database entity for posts published in monitored channels
 * @module entities/orm/ChannelPost
 */

import { EntitySchema } from 'typeorm';

/**
 * ChannelPost TypeORM Entity
 * Stores one row per channel post (album items are stored per item with shared groupedId).
 * Used for periodic (monthly) reports.
 *
 * Dates are stored as unix timestamps (seconds), same as Telegram message.date.
 */
export const ChannelPostEntity = new EntitySchema({
  name: 'ChannelPost',
  tableName: 'channel_posts',
  columns: {
    id: {
      type: 'integer',
      primary: true,
      generated: true,
    },
    channelId: {
      name: 'channel_id',
      type: 'varchar',
      nullable: false,
      comment: 'Telegram channel ID (-100...)',
    },
    messageId: {
      name: 'message_id',
      type: 'integer',
      nullable: false,
      comment: 'Telegram message ID inside channel',
    },
    groupedId: {
      name: 'grouped_id',
      type: 'varchar',
      nullable: true,
      comment: 'Album (media group) ID',
    },
    text: {
      type: 'text',
      nullable: true,
      comment: 'Post text or media caption',
    },
    mediaType: {
      name: 'media_type',
      type: 'varchar',
      nullable: true,
      comment: 'photo, video, document, ... (null for text-only)',
    },
    postedAt: {
      name: 'posted_at',
      type: 'integer',
      nullable: false,
      comment: 'Unix timestamp when post was published',
    },
    editedAt: {
      name: 'edited_at',
      type: 'integer',
      nullable: true,
      comment: 'Unix timestamp of last text edit',
    },
    deletedAt: {
      name: 'deleted_at',
      type: 'integer',
      nullable: true,
      comment: 'Unix timestamp when post was deleted from channel',
    },
    createdAt: {
      name: 'created_at',
      type: 'datetime',
      createDate: true,
    },
  },
  uniques: [
    {
      name: 'UQ_CHANNEL_POST_CHANNEL_MESSAGE',
      columns: ['channelId', 'messageId'],
    },
  ],
  indices: [
    {
      name: 'IDX_CHANNEL_POST_CHANNEL_POSTED',
      columns: ['channelId', 'postedAt'],
    },
  ],
});

export default ChannelPostEntity;
