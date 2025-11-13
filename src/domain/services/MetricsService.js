/**
 * @fileoverview Metrics Service
 * Aggregates and calculates system metrics
 * @module domain/services/MetricsService
 */

/**
 * Metrics Service
 * Handles metrics aggregation
 * 
 * @class MetricsService
 */
class MetricsService {
  /**
   * Session repository
   * @private
   */
  #sessionRepository;

  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * User repository
   * @private
   */
  #userRepository;

  /**
   * Message repository
   * @private
   */
  #messageRepository;

  /**
   * Admin repository
   * @private
   */
  #adminRepository;

  /**
   * Creates metrics service
   * @param {Object} repositories - Repositories
   */
  constructor(repositories) {
    this.#sessionRepository = repositories.sessionRepository;
    this.#channelRepository = repositories.channelRepository;
    this.#userRepository = repositories.userRepository;
    this.#messageRepository = repositories.messageRepository;
    this.#adminRepository = repositories.adminRepository;
  }

  /**
   * Gets overall system metrics
   * @returns {Promise<Object>} Metrics
   */
  async getOverallMetrics() {
    const [sessionStats, channelStats, userStats, messageStats, adminStats] = 
      await Promise.all([
        this.#sessionRepository.getStatistics(),
        this.#channelRepository.getStatistics(),
        this.#userRepository.getStatistics(),
        this.#messageRepository.getForwardingStatistics(),
        this.#adminRepository.getStatistics()
      ]);

    return {
      sessions: sessionStats,
      channels: channelStats,
      users: userStats,
      messages: messageStats,
      admins: adminStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gets session metrics
   * @returns {Promise<Object>} Session metrics
   */
  async getSessionMetrics() {
    return await this.#sessionRepository.getStatistics();
  }

  /**
   * Gets channel metrics
   * @param {string} channelId - Optional channel ID
   * @returns {Promise<Object>} Channel metrics
   */
  async getChannelMetrics(channelId = null) {
    if (channelId) {
      const [channel, users, messages] = await Promise.all([
        this.#channelRepository.findById(channelId),
        this.#userRepository.findByChannel(channelId),
        this.#messageRepository.findByChannel(channelId)
      ]);

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      return {
        channel: {
          id: channel.channelId,
          title: channel.title,
          memberCount: channel.memberCount,
          forwardEnabled: channel.forwardEnabled,
          adminSession: channel.adminSessionPhone
        },
        metrics: {
          totalUsers: users.length,
          totalMessages: messages.length,
          usersWithUsername: users.filter(u => u.hasUsername()).length
        }
      };
    }

    return await this.#channelRepository.getStatistics();
  }

  /**
   * Gets forwarding metrics
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Forwarding metrics
   */
  async getForwardingMetrics(filters = {}) {
    return await this.#messageRepository.getForwardingStatistics(filters);
  }

  /**
   * Gets daily metrics
   * @returns {Promise<Object>} Daily metrics
   */
  async getDailyMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = today.toISOString();
    const toDate = new Date().toISOString();

    return await this.getForwardingMetrics({ fromDate, toDate });
  }

  /**
   * Gets weekly metrics
   * @returns {Promise<Object>} Weekly metrics
   */
  async getWeeklyMetrics() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const fromDate = weekAgo.toISOString();
    const toDate = new Date().toISOString();

    return await this.getForwardingMetrics({ fromDate, toDate });
  }

  /**
   * Gets system health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const [sessions, channels, recentMessages] = await Promise.all([
      this.#sessionRepository.findByStatus('active'),
      this.#channelRepository.findEnabled(),
      this.#messageRepository.findAll({ limit: 10 })
    ]);

    const isHealthy = 
      sessions.length > 0 && 
      channels.length > 0 &&
      recentMessages.length > 0;

    return {
      healthy: isHealthy,
      activeSessions: sessions.length,
      enabledChannels: channels.length,
      recentActivity: recentMessages.length > 0,
      timestamp: new Date()
    };
  }
}

export default MetricsService;
