/**
 * @fileoverview Session Authentication Service
 * Handles Telegram session authentication with UI interactions
 * Refactored from src/bots/adminBotAuth.js with Clean Architecture
 * @module presentation/services/SessionAuthenticationService
 */

import { Markup } from 'telegraf';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../shared/logger.js';

/**
 * Session Authentication Service
 * Manages interactive session authentication via Telegram UI
 * 
 * @class SessionAuthenticationService
 */
export class SessionAuthenticationService {
  #authSessions;
  #logger;
  #createSessionUseCase;
  #userBotController;

  /**
   * Creates SessionAuthenticationService instance
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} dependencies.createSessionUseCase - Use case for creating sessions
   */
  constructor(dependencies) {
    this.#authSessions = new Map();
    this.#logger = createChildLogger({ component: 'SessionAuthenticationService' });
    this.#createSessionUseCase = dependencies.createSessionUseCase;
    this.#userBotController = null;
  }

  /**
   * Sets UserBot controller reference
   * @param {Object} controller - UserBot controller instance
   */
  setUserBotController(controller) {
    this.#userBotController = controller;
  }

  /**
   * Registers authentication handlers on Telegraf bot
   * @param {Object} bot - Telegraf bot instance
   */
  registerHandlers(bot) {
    // Add session callback
    bot.action('add_session', async (ctx) => {
      await ctx.answerCbQuery();
      await this.startPhoneInput(ctx);
    });

    // Phone numpad callbacks
    bot.action(/^phone_(\d)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const digit = ctx.match[1];
      await this.handlePhoneDigit(ctx, digit);
    });

    bot.action('phone_plus', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handlePhoneDigit(ctx, '+');
    });

    bot.action('phone_backspace', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handlePhoneBackspace(ctx);
    });

    bot.action('phone_confirm', async (ctx) => {
      await ctx.answerCbQuery();
      setImmediate(async () => {
        try {
          await this.confirmPhoneNumber(ctx);
        } catch (error) {
          this.#logger.error('Error in phone confirmation', error);
          try {
            await ctx.editMessageText(
              `❌ <b>Error</b>\n\nFailed to process phone confirmation: ${error.message}\n\nPlease try again.`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🔄 Try Again', callback_data: 'add_session' },
                    { text: '🏠 Main Menu', callback_data: 'main_menu' }
                  ]]
                }
              }
            );
          } catch (editError) {
            this.#logger.error('Error editing message after phone confirmation error', editError);
          }
        }
      });
    });

    // Code numpad callbacks
    bot.action(/^code_(\d)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const digit = ctx.match[1];
      await this.handleCodeDigit(ctx, digit);
    });

    bot.action('code_backspace', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleCodeBackspace(ctx);
    });

    bot.action('code_confirm', async (ctx) => {
      await ctx.answerCbQuery();
      setImmediate(async () => {
        try {
          await this.confirmVerificationCode(ctx);
        } catch (error) {
          this.#logger.error('Error in code confirmation', error);
          try {
            await ctx.editMessageText(
              `❌ <b>Error</b>\n\nFailed to verify code: ${error.message}\n\nPlease try again.`,
              {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🔄 Try Again', callback_data: 'add_session' },
                    { text: '🏠 Main Menu', callback_data: 'main_menu' }
                  ]]
                }
              }
            );
          } catch (editError) {
            this.#logger.error('Error editing message after code confirmation error', editError);
          }
        }
      });
    });

    // Cancel authentication
    bot.action(/^cancel_auth_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const authId = ctx.match[1];
      await this.cancelAuth(ctx, authId);
    });

    // Handle text messages for 2FA password
    bot.on('text', async (ctx) => {
      await this.handlePasswordTextMessage(ctx);
    });
  }

  /**
   * Starts phone number input process
   * @param {Object} ctx - Telegraf context
   */
  async startPhoneInput(ctx) {
    const userId = ctx.from.id;
    const authId = `${userId}_${Date.now()}`;

    this.#authSessions.set(authId, {
      userId,
      step: 'phone',
      phone: '',
      startTime: Date.now()
    });

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code></code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = this.#createPhoneNumpad('', authId);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard
      });
    }
  }

  /**
   * Handles phone number digit input
   * @param {Object} ctx - Telegraf context
   * @param {string} digit - Digit to add
   */
  async handlePhoneDigit(ctx, digit) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    authSession.phone += digit;

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code>${authSession.phone}</code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = this.#createPhoneNumpad(authSession.phone, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  /**
   * Handles phone number backspace
   * @param {Object} ctx - Telegraf context
   */
  async handlePhoneBackspace(ctx) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    authSession.phone = authSession.phone.slice(0, -1);

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code>${authSession.phone}</code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = this.#createPhoneNumpad(authSession.phone, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  /**
   * Confirms phone number and initiates Telegram authentication
   * @param {Object} ctx - Telegraf context
   */
  async confirmPhoneNumber(ctx) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.phone || authSession.phone.length < 10) {
      await ctx.answerCbQuery('❌ Please enter a valid phone number', { show_alert: true });
      return;
    }

    try {
      await ctx.editMessageText(
        `📱 <b>Connecting...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Connecting to Telegram...`,
        { parse_mode: 'HTML' }
      );

      const client = new TelegramClient(
        new StringSession(''),
        config.telegram.apiId,
        config.telegram.apiHash,
        { connectionRetries: 5 }
      );

      authSession.client = client;
      authSession.step = 'code';
      authSession.code = '';

      await client.connect();

      const result = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber: authSession.phone,
          apiId: config.telegram.apiId,
          apiHash: config.telegram.apiHash,
          settings: new Api.CodeSettings({})
        })
      );

      authSession.phoneCodeHash = result.phoneCodeHash;

      const text = `📱 <b>Verification Code</b>\n\n` +
                   `Phone: <code>${authSession.phone}</code>\n` +
                   `Code sent to your phone!\n\n` +
                   `Current: <code></code>\n\n` +
                   `Enter the verification code:`;

      const keyboard = this.#createCodeNumpad('', authId);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard
      });

      this.#logger.info('SMS verification code sent successfully', { phone: authSession.phone });

    } catch (error) {
      this.#logger.error('Error sending verification code', error);
      await ctx.editMessageText(
        `❌ <b>Error</b>\n\nFailed to send verification code: ${error.message}\n\nPlease try again.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 Try Again', callback_data: 'add_session' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]]
          }
        }
      );

      if (authSession.client) {
        await authSession.client.disconnect();
      }
      this.#authSessions.delete(authId);
    }
  }

  /**
   * Handles verification code digit input
   * @param {Object} ctx - Telegraf context
   * @param {string} digit - Digit to add
   */
  async handleCodeDigit(ctx, digit) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    authSession.code += digit;

    const text = `📱 <b>Verification Code</b>\n\n` +
                 `Phone: <code>${authSession.phone}</code>\n` +
                 `Code sent to your phone!\n\n` +
                 `Current: <code>${authSession.code}</code>\n\n` +
                 `Enter the verification code:`;

    const keyboard = this.#createCodeNumpad(authSession.code, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  /**
   * Handles verification code backspace
   * @param {Object} ctx - Telegraf context
   */
  async handleCodeBackspace(ctx) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    authSession.code = authSession.code.slice(0, -1);

    const text = `📱 <b>Verification Code</b>\n\n` +
                 `Phone: <code>${authSession.phone}</code>\n` +
                 `Code sent to your phone!\n\n` +
                 `Current: <code>${authSession.code}</code>\n\n` +
                 `Enter the verification code:`;

    const keyboard = this.#createCodeNumpad(authSession.code, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  /**
   * Confirms verification code and completes authentication
   * @param {Object} ctx - Telegraf context
   */
  async confirmVerificationCode(ctx) {
    const userId = ctx.from.id;
    const { authId, authSession } = this.#findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.code || authSession.code.length < 4) {
      await ctx.answerCbQuery('❌ Please enter a valid verification code', { show_alert: true });
      return;
    }

    try {
      await ctx.editMessageText(
        `📱 <b>Authenticating...</b>\n\nPhone: <code>${authSession.phone}</code>\nCode: <code>${authSession.code}</code>\n\n🔄 Authenticating with Telegram...`,
        { parse_mode: 'HTML' }
      );

      const client = authSession.client;

      const result = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: authSession.phone,
          phoneCodeHash: authSession.phoneCodeHash,
          phoneCode: authSession.code
        })
      );

      const me = await client.getMe();
      const sessionString = client.session.save();

      // Save session via use case
      await this.#createSessionUseCase.execute({
        phone: authSession.phone,
        userId: me.id.toString(),
        username: me.username || null,
        sessionString: sessionString,
        status: 'active'
      });

      // Add to UserBot controller if available
      if (this.#userBotController) {
        await this.#userBotController.addSession({
          phone: authSession.phone,
          user_id: me.id.toString(),
          session_string: sessionString,
          status: 'active'
        });
      }

      await ctx.editMessageText(
        `✅ <b>Session Added Successfully!</b>\n\nPhone: <code>${authSession.phone}</code>\nUser: <code>${me.firstName || ''} ${me.lastName || ''}</code>\nUsername: <code>@${me.username || 'N/A'}</code>\n\n🎉 Session is now active and ready!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 View Sessions', callback_data: 'sessions_list' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]]
          }
        }
      );

      await client.disconnect();
      this.#authSessions.delete(authId);

      this.#logger.info('Session added successfully', { phone: authSession.phone, userId: me.id });

    } catch (error) {
      this.#logger.error('Error during authentication', error);

      // Check if 2FA required
      if (error.message === 'PASSWORD_REQUIRED' || 
          error.errorMessage === 'SESSION_PASSWORD_NEEDED' || 
          error.className === 'SessionPasswordNeededError' ||
          error.message.includes('SESSION_PASSWORD_NEEDED')) {
        
        authSession.step = 'password';
        authSession.password = '';
        authSession.waitingForPasswordMessage = true;

        const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
                     `Phone: <code>${authSession.phone}</code>\n` +
                     `2FA password required!\n\n` +
                     `📝 <b>Please send your 2FA password as a message</b>\n` +
                     `(Type and send your password directly in the chat)\n\n` +
                     `💡 Your password will be automatically deleted for security.`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)]
        ]);

        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...keyboard
        });

      } else {
        await ctx.editMessageText(
          `❌ <b>Authentication Failed</b>\n\n${error.message}\n\nPlease try again.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          }
        );

        if (authSession.client) {
          await authSession.client.disconnect();
        }
        this.#authSessions.delete(authId);
      }
    }
  }

  /**
   * Handles 2FA password text message
   * @param {Object} ctx - Telegraf context
   */
  async handlePasswordTextMessage(ctx) {
    const userId = ctx.from.id;
    const messageText = ctx.message?.text;

    if (!messageText) return;

    const { authId, authSession } = this.#findAuthSession(userId, 'password', true);

    if (!authSession) return;

    // Delete user's password message for security
    try {
      await ctx.deleteMessage();
    } catch (error) {
      this.#logger.warn('Could not delete password message', error);
    }

    authSession.password = messageText;
    authSession.waitingForPasswordMessage = false;

    try {
      await ctx.reply(
        `🔐 <b>Authenticating with 2FA...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Verifying 2FA password...`,
        { parse_mode: 'HTML' }
      );

      const client = authSession.client;

      await client.invoke(
        new Api.auth.CheckPassword({
          password: await client.computeCheck(authSession.password)
        })
      );

      const me = await client.getMe();
      const sessionString = client.session.save();

      // Save session via use case
      await this.#createSessionUseCase.execute({
        phone: authSession.phone,
        userId: me.id.toString(),
        username: me.username || null,
        sessionString: sessionString,
        status: 'active'
      });

      // Add to UserBot controller if available
      if (this.#userBotController) {
        await this.#userBotController.addSession({
          phone: authSession.phone,
          user_id: me.id.toString(),
          session_string: sessionString,
          status: 'active'
        });
      }

      await ctx.reply(
        `✅ <b>Session Added Successfully!</b>\n\nPhone: <code>${authSession.phone}</code>\nUser: <code>${me.firstName || ''} ${me.lastName || ''}</code>\nUsername: <code>@${me.username || 'N/A'}</code>\n\n🎉 Session is now active and ready!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 View Sessions', callback_data: 'sessions_list' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]]
          }
        }
      );

      await client.disconnect();
      this.#authSessions.delete(authId);

      this.#logger.info('Session added via 2FA', { phone: authSession.phone, userId: me.id });

    } catch (error) {
      this.#logger.error('Error during 2FA authentication', error);

      await ctx.reply(
        `❌ <b>2FA Authentication Failed</b>\n\nIncorrect password. Please try again.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 Try Again', callback_data: 'add_session' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]]
          }
        }
      );

      if (authSession.client) {
        await authSession.client.disconnect();
      }
      this.#authSessions.delete(authId);
    }
  }

  /**
   * Cancels authentication process
   * @param {Object} ctx - Telegraf context
   * @param {string} authId - Authentication session ID
   */
  async cancelAuth(ctx, authId) {
    const authSession = this.#authSessions.get(authId);

    if (authSession?.client) {
      try {
        await authSession.client.disconnect();
      } catch (error) {
        this.#logger.warn('Error disconnecting client during cancel', error);
      }
    }

    this.#authSessions.delete(authId);

    await ctx.editMessageText('❌ Session authentication cancelled.', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
  }

  /**
   * Cleans up expired authentication sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expireTime = 10 * 60 * 1000; // 10 minutes

    for (const [authId, session] of this.#authSessions.entries()) {
      if (now - session.startTime > expireTime) {
        if (session.client) {
          try {
            session.client.disconnect();
          } catch (error) {
            this.#logger.warn('Error disconnecting expired client', error);
          }
        }
        this.#authSessions.delete(authId);
        this.#logger.info('Cleaned up expired auth session', { authId });
      }
    }
  }

  /**
   * Finds authentication session for user
   * @private
   * @param {number} userId - User ID
   * @param {string} step - Authentication step
   * @param {boolean} checkWaitingForPassword - Check if waiting for password message
   * @returns {Object} Session data
   */
  #findAuthSession(userId, step, checkWaitingForPassword = false) {
    for (const [id, session] of this.#authSessions.entries()) {
      if (session.userId === userId && session.step === step) {
        if (checkWaitingForPassword && !session.waitingForPasswordMessage) {
          continue;
        }
        return { authId: id, authSession: session };
      }
    }
    return { authId: null, authSession: null };
  }

  /**
   * Creates phone numpad keyboard
   * @private
   * @param {string} currentNumber - Current phone number
   * @param {string} authId - Authentication session ID
   * @returns {Object} Telegraf inline keyboard
   */
  #createPhoneNumpad(currentNumber, authId) {
    const keyboard = [];

    keyboard.push([
      Markup.button.callback('1', 'phone_1'),
      Markup.button.callback('2', 'phone_2'),
      Markup.button.callback('3', 'phone_3')
    ]);

    keyboard.push([
      Markup.button.callback('4', 'phone_4'),
      Markup.button.callback('5', 'phone_5'),
      Markup.button.callback('6', 'phone_6')
    ]);

    keyboard.push([
      Markup.button.callback('7', 'phone_7'),
      Markup.button.callback('8', 'phone_8'),
      Markup.button.callback('9', 'phone_9')
    ]);

    keyboard.push([
      Markup.button.callback('+', 'phone_plus'),
      Markup.button.callback('0', 'phone_0'),
      Markup.button.callback('⌫', 'phone_backspace')
    ]);

    keyboard.push([
      Markup.button.callback('✅ Confirm', 'phone_confirm'),
      Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
    ]);

    return Markup.inlineKeyboard(keyboard);
  }

  /**
   * Creates code numpad keyboard
   * @private
   * @param {string} currentCode - Current verification code
   * @param {string} authId - Authentication session ID
   * @returns {Object} Telegraf inline keyboard
   */
  #createCodeNumpad(currentCode, authId) {
    const keyboard = [];

    keyboard.push([
      Markup.button.callback('1', 'code_1'),
      Markup.button.callback('2', 'code_2'),
      Markup.button.callback('3', 'code_3')
    ]);

    keyboard.push([
      Markup.button.callback('4', 'code_4'),
      Markup.button.callback('5', 'code_5'),
      Markup.button.callback('6', 'code_6')
    ]);

    keyboard.push([
      Markup.button.callback('7', 'code_7'),
      Markup.button.callback('8', 'code_8'),
      Markup.button.callback('9', 'code_9')
    ]);

    keyboard.push([
      Markup.button.callback('⌫', 'code_backspace'),
      Markup.button.callback('0', 'code_0'),
      Markup.button.callback('🗑️', 'code_clear')
    ]);

    keyboard.push([
      Markup.button.callback('✅ Confirm', 'code_confirm'),
      Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
    ]);

    return Markup.inlineKeyboard(keyboard);
  }
}
