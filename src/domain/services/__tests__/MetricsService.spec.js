/**
 * @fileoverview Unit Tests for MetricsService
 * Tests performance and event metrics collection and reporting
 */

import MetricsService from '../MetricsService.js';

describe('MetricsService', () => {
  let metricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  describe('Initialization', () => {
    test('should initialize with empty metrics', () => {
      // Assert
      expect(metricsService).toBeDefined();
      expect(metricsService.getMetrics()).toEqual({});
    });

    test('should initialize with default config', () => {
      // Assert
      expect(metricsService.config).toBeDefined();
      expect(metricsService.isEnabled()).toBe(true);
    });
  });

  describe('Event Tracking', () => {
    test('should track event occurrence', () => {
      // Act
      metricsService.trackEvent('message_sent', { userId: '123' });

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.message_sent).toBeDefined();
      expect(metrics.message_sent.count).toBe(1);
    });

    test('should increment event count', () => {
      // Act
      metricsService.trackEvent('message_sent');
      metricsService.trackEvent('message_sent');
      metricsService.trackEvent('message_sent');

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.message_sent.count).toBe(3);
    });

    test('should track multiple different events', () => {
      // Act
      metricsService.trackEvent('message_sent');
      metricsService.trackEvent('forwarded');
      metricsService.trackEvent('error');

      // Assert
      const metrics = metricsService.getMetrics();
      expect(Object.keys(metrics).length).toBe(3);
    });

    test('should attach metadata to event', () => {
      // Arrange
      const metadata = { userId: '123', channelId: '456' };

      // Act
      metricsService.trackEvent('message_sent', metadata);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.message_sent.lastMetadata).toEqual(metadata);
    });
  });

  describe('Performance Timing', () => {
    test('should track operation duration', () => {
      // Act
      metricsService.startTiming('db_query');
      setTimeout(() => {
        metricsService.endTiming('db_query');
      }, 50);

      // Assert - wait for timeout
      return new Promise(resolve => {
        setTimeout(() => {
          const metrics = metricsService.getMetrics();
          expect(metrics.db_query).toBeDefined();
          expect(metrics.db_query.duration).toBeGreaterThanOrEqual(50);
          resolve();
        }, 60);
      });
    });

    test('should calculate average timing', () => {
      // Act
      metricsService.startTiming('api_call');
      metricsService.endTiming('api_call');
      metricsService.startTiming('api_call');
      metricsService.endTiming('api_call');

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.api_call.count).toBe(2);
      expect(metrics.api_call.avgDuration).toBeDefined();
    });

    test('should track min and max timing', () => {
      // Act
      metricsService.recordTiming('operation', 100);
      metricsService.recordTiming('operation', 200);
      metricsService.recordTiming('operation', 150);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.operation.minDuration).toBe(100);
      expect(metrics.operation.maxDuration).toBe(200);
    });
  });

  describe('Error Metrics', () => {
    test('should track error occurrence', () => {
      // Act
      metricsService.trackError('database_error', new Error('Connection failed'));

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.database_error).toBeDefined();
      expect(metrics.database_error.count).toBe(1);
    });

    test('should increment error count', () => {
      // Act
      metricsService.trackError('api_error', new Error('Timeout'));
      metricsService.trackError('api_error', new Error('Timeout'));

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.api_error.count).toBe(2);
    });

    test('should capture error message', () => {
      // Arrange
      const error = new Error('Failed to save');

      // Act
      metricsService.trackError('save_error', error);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.save_error.lastError).toBe('Failed to save');
    });
  });

  describe('Metric Aggregation', () => {
    test('should get metric summary', () => {
      // Arrange
      metricsService.trackEvent('message_sent', { userId: '1' });
      metricsService.trackEvent('message_sent', { userId: '2' });
      metricsService.trackEvent('forwarded');

      // Act
      const summary = metricsService.getSummary();

      // Assert
      expect(summary).toBeDefined();
      expect(summary.totalEvents).toBe(3);
      expect(summary.eventTypes).toEqual(['message_sent', 'forwarded']);
    });

    test('should calculate success rate', () => {
      // Act
      metricsService.trackEvent('attempt');
      metricsService.trackEvent('attempt');
      metricsService.trackEvent('success');

      // Assert
      const rate = metricsService.getSuccessRate('attempt', 'success');
      expect(rate).toBe(0.5);
    });

    test('should reset metrics', () => {
      // Arrange
      metricsService.trackEvent('event');

      // Act
      metricsService.reset();

      // Assert
      expect(metricsService.getMetrics()).toEqual({});
    });

    test('should reset specific metric', () => {
      // Arrange
      metricsService.trackEvent('event1');
      metricsService.trackEvent('event2');

      // Act
      metricsService.resetMetric('event1');

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.event1).toBeUndefined();
      expect(metrics.event2).toBeDefined();
    });
  });

  describe('Threshold Detection', () => {
    test('should detect when metric exceeds threshold', () => {
      // Arrange
      metricsService.setThreshold('errors', 5);

      // Act
      for (let i = 0; i < 6; i++) {
        metricsService.trackError('api_error');
      }

      // Assert
      expect(metricsService.isThresholdExceeded('errors')).toBe(true);
    });

    test('should detect when metric is below threshold', () => {
      // Arrange
      metricsService.setThreshold('errors', 10);

      // Act
      metricsService.trackError('api_error');
      metricsService.trackError('api_error');

      // Assert
      expect(metricsService.isThresholdExceeded('errors')).toBe(false);
    });
  });

  describe('Health Check', () => {
    test('should report healthy when all metrics normal', () => {
      // Arrange
      metricsService.trackEvent('operation');
      metricsService.trackEvent('operation');

      // Act
      const health = metricsService.getHealth();

      // Assert
      expect(health.status).toBe('healthy');
    });

    test('should report degraded when errors present', () => {
      // Arrange
      metricsService.trackError('database_error', new Error('Connection failed'));
      metricsService.setThreshold('errors', 1);

      // Act
      const health = metricsService.getHealth();

      // Assert
      expect(health.status).toMatch(/degraded|warning/i);
    });
  });

  describe('Export & Import', () => {
    test('should export metrics to JSON', () => {
      // Arrange
      metricsService.trackEvent('operation');
      metricsService.trackEvent('operation');

      // Act
      const exported = metricsService.export();

      // Assert
      expect(exported).toBeDefined();
      expect(exported.operation).toBeDefined();
    });

    test('should import metrics from JSON', () => {
      // Arrange
      const data = {
        operation: { count: 5 }
      };

      // Act
      metricsService.import(data);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.operation.count).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid event tracking', () => {
      // Act
      for (let i = 0; i < 1000; i++) {
        metricsService.trackEvent('rapid_event');
      }

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.rapid_event.count).toBe(1000);
    });

    test('should handle undefined metadata', () => {
      // Act
      metricsService.trackEvent('event', undefined);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.event).toBeDefined();
    });

    test('should handle null error', () => {
      // Act
      metricsService.trackError('null_error', null);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.null_error).toBeDefined();
    });

    test('should handle very long operation timing', () => {
      // Act
      metricsService.recordTiming('long_op', 86400000); // 24 hours

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.long_op.duration).toBe(86400000);
    });
  });

  describe('Integration', () => {
    test('should work with multiple services', () => {
      // Act
      metricsService.trackEvent('db_query');
      metricsService.startTiming('api_call');
      metricsService.trackError('retry', new Error('Timeout'));

      // Assert
      const metrics = metricsService.getMetrics();
      expect(Object.keys(metrics).length).toBe(3);
    });

    test('should disable and enable metrics', () => {
      // Act
      metricsService.disable();
      metricsService.trackEvent('event');

      // Assert
      expect(metricsService.getMetrics()).toEqual({});

      // Act
      metricsService.enable();
      metricsService.trackEvent('event');

      // Assert
      expect(metricsService.getMetrics().event).toBeDefined();
    });
  });
});
