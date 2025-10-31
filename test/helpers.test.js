/**
 * Test suite for utility helper functions
 * Tests common utility functions used across the application
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { 
  sanitizeText, 
  extractChannelInfo, 
  extractUserInfo, 
  isValidChannelId, 
  isValidUserId,
  formatTimestamp,
  chunkArray,
  safeJsonParse,
  safeJsonStringify
} from '../src/utils/helpers.js';

test('Utility Helper Tests', async (t) => {
  
  await t.test('sanitizeText should clean and truncate text', () => {
    assert.equal(sanitizeText('Hello World'), 'Hello World');
    assert.equal(sanitizeText(''), '');
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText('A'.repeat(1000), 10), 'A'.repeat(7) + '...');
  });

  await t.test('extractChannelInfo should extract channel data', () => {
    const mockChannel = {
      id: '-1001234567890',
      title: 'Test Channel',
      username: 'testchannel',
      className: 'Channel'
    };
    
    const result = extractChannelInfo(mockChannel);
    assert.equal(result.channelId, '-1001234567890');
    assert.equal(result.title, 'Test Channel');
    assert.equal(result.username, 'testchannel');
    assert.equal(result.isChannel, true);
  });

  await t.test('extractUserInfo should extract user data', () => {
    const mockUser = {
      id: '123456789',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      bot: false
    };
    
    const result = extractUserInfo(mockUser);
    assert.equal(result.userId, '123456789');
    assert.equal(result.firstName, 'John');
    assert.equal(result.lastName, 'Doe');
    assert.equal(result.username, 'johndoe');
    assert.equal(result.isBot, false);
  });

  await t.test('isValidChannelId should validate channel IDs', () => {
    assert.equal(isValidChannelId('-1001234567890'), true);
    assert.equal(isValidChannelId('123456789'), true);
    assert.equal(isValidChannelId(''), false);
    assert.equal(isValidChannelId(null), false);
    assert.equal(isValidChannelId('invalid'), false);
  });

  await t.test('isValidUserId should validate user IDs', () => {
    assert.equal(isValidUserId('123456789'), true);
    assert.equal(isValidUserId('0'), false);
    assert.equal(isValidUserId('-123'), false);
    assert.equal(isValidUserId(''), false);
    assert.equal(isValidUserId(null), false);
  });

  await t.test('formatTimestamp should format dates', () => {
    const date = new Date('2023-01-01T12:00:00Z');
    const result = formatTimestamp(date);
    assert(typeof result === 'string');
    assert(result.includes('2023'));
  });

  await t.test('chunkArray should split arrays into chunks', () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunks = chunkArray(array, 3);
    
    assert.equal(chunks.length, 4);
    assert.deepEqual(chunks[0], [1, 2, 3]);
    assert.deepEqual(chunks[3], [10]);
    
    // Test edge cases
    assert.deepEqual(chunkArray([], 3), []);
    assert.deepEqual(chunkArray([1, 2], 5), [[1, 2]]);
  });

  await t.test('safeJsonParse should parse JSON safely', () => {
    assert.deepEqual(safeJsonParse('{"test": true}'), { test: true });
    assert.equal(safeJsonParse('invalid json'), null);
    assert.equal(safeJsonParse('invalid json', {}), {});
  });

  await t.test('safeJsonStringify should stringify JSON safely', () => {
    assert.equal(safeJsonStringify({ test: true }), '{"test":true}');
    
    // Test circular reference
    const circular = {};
    circular.self = circular;
    assert.equal(safeJsonStringify(circular), '{}');
  });

});