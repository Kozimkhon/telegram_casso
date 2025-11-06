/**
 * AdminBot Session Management Extensions
 * Provides UI for managing multiple userbot sessions
 */

import { Markup } from 'telegraf';
import { 
  getAllSessions, 
  pauseBot as pauseBotInDB,
  resumeBot as resumeBotInDB,
  deleteSession 
} from '../services/sessionService.js';
import { getSessionMetrics, getSystemMetrics } from '../services/metricsService.js';
import { userBotManager } from '../bots/userBotManager.js';
import { log } from '../utils/logger.js';

/**
 * Sets up session management commands and callbacks
 * @param {Object} bot - Telegraf bot instance
 * @param {Function} asyncErrorHandler - Error handler wrapper
 */
export function setupSessionManagement(bot, asyncErrorHandler) {
  // Command: List all sessions
  bot.command('sessions', asyncErrorHandler(async (ctx) => {
    await showSessionsList(ctx);
  }, 'Sessions command'));

  // Callback: Sessions list
  bot.action('sessions_list', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await showSessionsList(ctx);
  }, 'Sessions list callback'));

  // Callback: Session details
  bot.action(/^session_details_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const phone = ctx.match[1];
    await showSessionDetails(ctx, phone);
  }, 'Session details callback'));

  // Callback: Pause session
  bot.action(/^session_pause_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const phone = ctx.match[1];
    await pauseSession(ctx, phone);
  }, 'Pause session callback'));

  // Callback: Resume session
  bot.action(/^session_resume_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const phone = ctx.match[1];
    await resumeSession(ctx, phone);
  }, 'Resume session callback'));

  // Callback: Restart session
  bot.action(/^session_restart_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const phone = ctx.match[1];
    await restartSession(ctx, phone);
  }, 'Restart session callback'));

  // Callback: Session metrics
  bot.action(/^session_metrics_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const phone = ctx.match[1];
    await showSessionMetrics(ctx, phone);
  }, 'Session metrics callback'));

  // Callback: System metrics
  bot.action('system_metrics', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await showSystemMetrics(ctx);
  }, 'System metrics callback'));
}

/**
 * Shows list of all sessions
 * @param {Object} ctx - Telegraf context
 */
async function showSessionsList(ctx) {
  try {
    const sessions = await getAllSessions();
    
    let text = `🔐 *Session Management*\n\n`;
    text += `Total Sessions: ${sessions.length}\n\n`;

    if (sessions.length === 0) {
      text += '❌ No sessions found. Add sessions via the database or /add_session command.';
    } else {
      sessions.forEach((session, index) => {
        const statusEmoji = session.status === 'active' ? '✅' : 
                           session.status === 'paused' ? '⏸️' : '❌';
        const autoPauseEmoji = session.auto_paused ? '🚨' : '';
        
        text += `${index + 1}. ${statusEmoji}${autoPauseEmoji} ${session.phone}\n`;
        text += `   Status: ${session.status}\n`;
        if (session.pause_reason) {
          text += `   Reason: ${session.pause_reason}\n`;
        }
        if (session.username) {
          text += `   User: @${session.username}\n`;
        }
        text += `\n`;
      });
    }

    // Build keyboard
    const buttons = [];
    
    // Session control buttons (max 3 per row)
    const sessionButtons = [];
    sessions.forEach((session, index) => {
      sessionButtons.push(
        Markup.button.callback(`📱 ${index + 1}`, `session_details_${session.phone}`)
      );
    });
    
    // Split into rows of 3
    for (let i = 0; i < sessionButtons.length; i += 3) {
      buttons.push(sessionButtons.slice(i, i + 3));
    }

    // System metrics and back buttons
    buttons.push([
      Markup.button.callback('📊 System Metrics', 'system_metrics')
    ]);
    buttons.push([
      Markup.button.callback('🏠 Main Menu', 'main_menu')
    ]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    log.error('Error showing sessions list', error);
    await ctx.reply('❌ Error loading sessions list.');
  }
}

/**
 * Shows detailed information for a session
 * @param {Object} ctx - Telegraf context
 * @param {string} phone - Phone number
 */
async function showSessionDetails(ctx, phone) {
  try {
    const sessions = await getAllSessions();
    const session = sessions.find(s => s.phone === phone);
    
    if (!session) {
      await ctx.reply('❌ Session not found.');
      return;
    }

    const userBot = userBotManager.getUserBot(phone);
    const botStatus = userBot ? userBot.getStatus() : null;

    let text = `🔐 *Session Details*\n\n`;
    text += `📱 Phone: \`${session.phone}\`\n`;
    text += `👤 User ID: \`${session.user_id || 'N/A'}\`\n`;
    
    if (session.username) {
      text += `🏷 Username: @${session.username}\n`;
    }
    if (session.first_name) {
      text += `📝 Name: ${session.first_name}${session.last_name ? ' ' + session.last_name : ''}\n`;
    }

    text += `\n*Status Information:*\n`;
    const statusEmoji = session.status === 'active' ? '✅' : 
                       session.status === 'paused' ? '⏸️' : '❌';
    text += `   Status: ${statusEmoji} ${session.status.toUpperCase()}\n`;
    
    if (session.auto_paused) {
      text += `   🚨 Auto-Paused: Yes\n`;
      if (session.pause_reason) {
        text += `   Reason: ${session.pause_reason}\n`;
      }
      if (session.flood_wait_until) {
        text += `   Wait Until: ${new Date(session.flood_wait_until).toLocaleString()}\n`;
      }
    }

    if (session.last_error) {
      text += `   ⚠️ Last Error: ${session.last_error}\n`;
    }

    if (botStatus) {
      text += `\n*Bot Status:*\n`;
      text += `   Running: ${botStatus.isRunning ? '✅' : '❌'}\n`;
      text += `   Connected: ${botStatus.isConnected ? '✅' : '❌'}\n`;
      text += `   Channels: ${botStatus.connectedChannels}\n`;
    }

    text += `\n*Activity:*\n`;
    text += `   Last Active: ${session.last_active ? new Date(session.last_active).toLocaleString() : 'Never'}\n`;
    text += `   Created: ${new Date(session.created_at).toLocaleString()}\n`;

    // Control buttons
    const buttons = [];
    
    if (session.status === 'active' && !session.auto_paused) {
      buttons.push([
        Markup.button.callback('⏸️ Pause', `session_pause_${phone}`)
      ]);
    } else if (session.status === 'paused') {
      buttons.push([
        Markup.button.callback('▶️ Resume', `session_resume_${phone}`)
      ]);
    }
    
    buttons.push([
      Markup.button.callback('🔄 Restart', `session_restart_${phone}`),
      Markup.button.callback('📊 Metrics', `session_metrics_${phone}`)
    ]);
    
    buttons.push([
      Markup.button.callback('⬅️ Back to Sessions', 'sessions_list')
    ]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    log.error('Error showing session details', { phone, error: error.message });
    await ctx.reply('❌ Error loading session details.');
  }
}

/**
 * Pauses a session
 * @param {Object} ctx - Telegraf context
 * @param {string} phone - Phone number
 */
async function pauseSession(ctx, phone) {
  try {
    const success = await userBotManager.pauseBot(phone, 'Manual pause via AdminBot');
    
    if (success) {
      await ctx.reply(`✅ Session ${phone} has been paused.`);
    } else {
      await ctx.reply(`❌ Failed to pause session ${phone}.`);
    }
    
    // Refresh details
    setTimeout(() => showSessionDetails(ctx, phone), 1000);
  } catch (error) {
    log.error('Error pausing session', { phone, error: error.message });
    await ctx.reply('❌ Error pausing session.');
  }
}

/**
 * Resumes a session
 * @param {Object} ctx - Telegraf context
 * @param {string} phone - Phone number
 */
async function resumeSession(ctx, phone) {
  try {
    const success = await userBotManager.resumeBot(phone);
    
    if (success) {
      await ctx.reply(`✅ Session ${phone} has been resumed.`);
    } else {
      await ctx.reply(`❌ Failed to resume session ${phone}.`);
    }
    
    // Refresh details
    setTimeout(() => showSessionDetails(ctx, phone), 1000);
  } catch (error) {
    log.error('Error resuming session', { phone, error: error.message });
    await ctx.reply('❌ Error resuming session.');
  }
}

/**
 * Restarts a session
 * @param {Object} ctx - Telegraf context
 * @param {string} phone - Phone number
 */
async function restartSession(ctx, phone) {
  try {
    await ctx.reply(`🔄 Restarting session ${phone}...`);
    
    // Stop the bot
    await userBotManager.removeUserBot(phone);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get session data
    const sessions = await getAllSessions();
    const sessionData = sessions.find(s => s.phone === phone);
    
    if (!sessionData) {
      await ctx.reply(`❌ Session ${phone} not found in database.`);
      return;
    }
    
    // Start it again
    await userBotManager.addUserBot(sessionData);
    
    await ctx.reply(`✅ Session ${phone} has been restarted.`);
    
    // Refresh details
    setTimeout(() => showSessionDetails(ctx, phone), 1000);
  } catch (error) {
    log.error('Error restarting session', { phone, error: error.message });
    await ctx.reply(`❌ Error restarting session: ${error.message}`);
  }
}

/**
 * Shows metrics for a session
 * @param {Object} ctx - Telegraf context
 * @param {string} phone - Phone number
 */
async function showSessionMetrics(ctx, phone) {
  try {
    const metrics = await getSessionMetrics(phone);
    
    let text = `📊 *Session Metrics*\n\n`;
    text += `📱 Phone: \`${phone}\`\n\n`;
    
    text += `*Summary:*\n`;
    text += `   Messages Sent: ${metrics.summary.totalSent}\n`;
    text += `   Messages Failed: ${metrics.summary.totalFailed}\n`;
    text += `   Flood Errors: ${metrics.summary.totalFloodErrors}\n`;
    text += `   Spam Warnings: ${metrics.summary.totalSpamWarnings}\n`;
    
    const successRate = metrics.summary.totalSent + metrics.summary.totalFailed > 0
      ? ((metrics.summary.totalSent / (metrics.summary.totalSent + metrics.summary.totalFailed)) * 100).toFixed(1)
      : 0;
    text += `   Success Rate: ${successRate}%\n`;

    if (metrics.details.length > 0) {
      text += `\n*Top Channels:*\n`;
      const topChannels = metrics.details
        .sort((a, b) => (b.messages_sent || 0) - (a.messages_sent || 0))
        .slice(0, 5);
      
      topChannels.forEach((detail, index) => {
        text += `   ${index + 1}. Channel ${detail.channel_id}: ${detail.messages_sent || 0} sent\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', `session_details_${phone}`)]
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    log.error('Error showing session metrics', { phone, error: error.message });
    await ctx.reply('❌ Error loading session metrics.');
  }
}

/**
 * Shows system-wide metrics
 * @param {Object} ctx - Telegraf context
 */
async function showSystemMetrics(ctx) {
  try {
    const metrics = await getSystemMetrics();
    const managerStatus = userBotManager.getStatus();
    
    let text = `📊 *System Metrics*\n\n`;
    
    text += `*Session Status:*\n`;
    text += `   Total Sessions: ${managerStatus.total}\n`;
    text += `   Active: ${managerStatus.active}\n`;
    text += `   Paused: ${managerStatus.paused}\n`;
    text += `   Error: ${managerStatus.error}\n\n`;
    
    text += `*Message Statistics:*\n`;
    text += `   Total Sent: ${metrics.summary.totalSent}\n`;
    text += `   Total Failed: ${metrics.summary.totalFailed}\n`;
    text += `   Flood Errors: ${metrics.summary.totalFloodErrors}\n`;
    text += `   Spam Warnings: ${metrics.summary.totalSpamWarnings}\n`;
    
    const successRate = metrics.summary.totalSent + metrics.summary.totalFailed > 0
      ? ((metrics.summary.totalSent / (metrics.summary.totalSent + metrics.summary.totalFailed)) * 100).toFixed(1)
      : 0;
    text += `   Success Rate: ${successRate}%\n\n`;
    
    text += `*Activity:*\n`;
    text += `   Active Sessions: ${metrics.activeSessions}\n`;
    text += `   Active Channels: ${metrics.activeChannels}\n`;
    text += `   Total Records: ${metrics.totalRecords}\n`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh', 'system_metrics')],
      [Markup.button.callback('⬅️ Back to Sessions', 'sessions_list')]
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } catch (error) {
    log.error('Error showing system metrics', error);
    await ctx.reply('❌ Error loading system metrics.');
  }
}

export default {
  setupSessionManagement,
  showSessionsList,
  showSessionDetails,
  showSessionMetrics,
  showSystemMetrics
};
