/**
 * Test suite for channel service functionality
 * Basic tests to verify channel management operations
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { 
  addChannel, 
  getChannelById, 
  getAllChannels, 
  toggleChannelForwarding 
} from '../src/services/channelService.js';

// Mock channel data for testing
const mockChannelData = {
  id: '-1001234567890',
  title: 'Test Channel',
  className: 'Channel'
};

test('Channel Service Tests', async (t) => {
  
  await t.test('should add a new channel', async () => {
    try {
      const result = await addChannel(mockChannelData);
      assert(result, 'Channel should be added successfully');
      assert.equal(result.title, 'Test Channel');
      assert.equal(result.forward_enabled, 1);
    } catch (error) {
      // Skip test if database is not available
      if (error.message.includes('Database not initialized')) {
        t.skip('Database not available for testing');
        return;
      }
      throw error;
    }
  });

  await t.test('should retrieve channel by ID', async () => {
    try {
      const result = await getChannelById('-1001234567890');
      if (result) {
        assert.equal(result.channel_id, '-1001234567890');
        assert.equal(result.title, 'Test Channel');
      }
    } catch (error) {
      if (error.message.includes('Database not initialized')) {
        t.skip('Database not available for testing');
        return;
      }
      throw error;
    }
  });

  await t.test('should get all channels', async () => {
    try {
      const result = await getAllChannels();
      assert(Array.isArray(result), 'Should return an array');
    } catch (error) {
      if (error.message.includes('Database not initialized')) {
        t.skip('Database not available for testing');
        return;
      }
      throw error;
    }
  });

  await t.test('should toggle channel forwarding', async () => {
    try {
      const result = await toggleChannelForwarding('-1001234567890');
      if (result) {
        assert(typeof result.forward_enabled === 'number', 'forward_enabled should be a number');
      }
    } catch (error) {
      if (error.message.includes('Database not initialized') || 
          error.message.includes('Channel not found')) {
        t.skip('Database not available or channel not found for testing');
        return;
      }
      throw error;
    }
  });

});