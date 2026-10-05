/**
 * @fileoverview Session Authentication Handlers
 * Handles Telegram session authentication callbacks
 * Migrated from SessionAuthenticationService
 * @module presentation/handlers/sessionAuthHandlers
 */

import { Markup } from 'telegraf';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { computeCheck } from 'telegram/Password.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../shared/logger.js';

const authSessions = new Map();
const logger = createChildLogger({ component: 'SessionAuthHandlers' });

/**
 * Creates session authentication handlers
 * @param {Object} dependencies - Injected dependencies
 * @returns {Object} Handler functions
 */
export function createSessionAuthHandlers(dependencies) {
  const { 
    createSessionUseCase, 
    updateAdminUseCase, 
    stateManager,
    channelRepository,
    sessionRepository,
    useCases,
    onSessionCreated // Callback when session is created
  } = dependencies;



  /**
   * Starts phone number input process
   */
  const handleStartPhoneInput = async (ctx) => {
    const userId = ctx.from.id;
    const authId = `${userId}_${Date.now()}`;

    authSessions.set(authId, {
      userId,
      step: 'phone',
      phone: '',
      startTime: Date.now()
    });

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code></code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = createPhoneNumpad('', authId);

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
  };

  /**
   * Handles phone number digit input
   */
  const handlePhoneDigit = async (ctx, digit) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    authSession.phone += digit;

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code>${authSession.phone}</code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = createPhoneNumpad(authSession.phone, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  };

  /**
   * Handles phone number backspace
   */
  const handlePhoneBackspace = async (ctx) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.phone) {
      await ctx.answerCbQuery('Already empty', { show_alert: false });
      return;
    }
    authSession.phone = authSession.phone.slice(0, -1);

    const text = `📱 <b>Add New Session</b>\n\n` +
                 `Please enter the phone number in international format:\n\n` +
                 `Current: <code>${authSession.phone}</code>\n\n` +
                 `Use the numpad below to enter the phone number:`;

    const keyboard = createPhoneNumpad(authSession.phone, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  };

  /**
   * Confirms phone number and initiates Telegram authentication
   */
  const handleConfirmPhoneNumber = async (ctx) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'phone');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.phone || authSession.phone.length < 10) {
      await ctx.answerCbQuery('❌ Please enter a valid phone number', { show_alert: true });
      return;
    }

    // Guard against double trigger (user pressing confirm twice)
    if (authSession.connecting) {
      await ctx.answerCbQuery('⏳ Already connecting...', { show_alert: false });
      return;
    }
    authSession.connecting = true;

    try {
      await ctx.editMessageText(
        `📱 <b>Connecting...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Connecting to Telegram...`,
        { parse_mode: 'HTML' }
      );

      const client = new TelegramClient(
        new StringSession(''),
        config.telegram.apiId,
        config.telegram.apiHash,
        {
          connectionRetries: 3,
          useWSS: false,
          // Suppress update-loop TIMEOUT noise on unauthenticated clients
          baseLogger: {
            levels: ['error'],
            canSend: () => false,
            log: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            trace: () => {},
            format: () => {},
          },
        }
      );

      authSession.client = client;

      await client.connect();

      // Wait until fully connected (retry up to 5 times, 1s each)
      let attempts = 0;
      while (!client.connected && attempts < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      if (!client.connected) {
        throw new Error('Could not connect to Telegram. Please try again.');
      }

      // Invoke SendCode with one reconnect-retry on disconnect errors
      let result;
      try {
        result = await client.invoke(
          new Api.auth.SendCode({
            phoneNumber: authSession.phone,
            apiId: config.telegram.apiId,
            apiHash: config.telegram.apiHash,
            settings: new Api.CodeSettings({})
          })
        );
      } catch (invokeError) {
        if (invokeError.message?.includes('disconnected') || invokeError.message?.includes('Cannot send')) {
          logger.warn('Disconnected during SendCode, reconnecting...', { phone: authSession.phone });
          await client.connect();
          await new Promise(resolve => setTimeout(resolve, 1500));
          result = await client.invoke(
            new Api.auth.SendCode({
              phoneNumber: authSession.phone,
              apiId: config.telegram.apiId,
              apiHash: config.telegram.apiHash,
              settings: new Api.CodeSettings({})
            })
          );
        } else {
          throw invokeError;
        }
      }

      authSession.phoneCodeHash = result.phoneCodeHash;
      // Only switch to code step after SendCode succeeds
      authSession.step = 'code';
      authSession.code = '';

      const text = `📱 <b>Verification Code</b>\n\n` +
                   `Phone: <code>${authSession.phone}</code>\n` +
                   `Code sent to your phone!\n\n` +
                   `Current: <code></code>\n\n` +
                   `Enter the verification code:`;

      const keyboard = createCodeNumpad('', authId);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard
      });

      logger.info('SMS verification code sent successfully', { phone: authSession.phone });

    } catch (error) {
      logger.error('Error sending verification code', error);
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
      authSessions.delete(authId);
    }
  };

  /**
   * Handles verification code digit input
   */
  const handleCodeDigit = async (ctx, digit) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (authSession.code.length >= 5) {
      await ctx.answerCbQuery('Code is already 5 digits', { show_alert: false });
      return;
    }
    authSession.code += digit;

    const text = `📱 <b>Verification Code</b>\n\n` +
                 `Phone: <code>${authSession.phone}</code>\n` +
                 `Code sent to your phone!\n\n` +
                 `Current: <code>${authSession.code}</code>\n\n` +
                 `Enter the verification code:`;

    const keyboard = createCodeNumpad(authSession.code, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  };

  /**
   * Handles verification code backspace
   */
  const handleCodeBackspace = async (ctx) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.code) {
      await ctx.answerCbQuery('Already empty', { show_alert: false });
      return;
    }
    authSession.code = authSession.code.slice(0, -1);

    const text = `📱 <b>Verification Code</b>\n\n` +
                 `Phone: <code>${authSession.phone}</code>\n` +
                 `Code sent to your phone!\n\n` +
                 `Current: <code>${authSession.code}</code>\n\n` +
                 `Enter the verification code:`;

    const keyboard = createCodeNumpad(authSession.code, authId);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard
    });
  };

  const handleCodeClear = async (ctx) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.answerCbQuery('Session expired', { show_alert: false });
      return;
    }

    if (!authSession.code) {
      await ctx.answerCbQuery('Already empty', { show_alert: false });
      return;
    }

    authSession.code = '';

    const text = `📱 <b>Verification Code</b>\n\n` +
                 `Phone: <code>${authSession.phone}</code>\n` +
                 `Code sent to your phone!\n\n` +
                 `Current: <code></code>\n\n` +
                 `Enter the verification code:`;

    const keyboard = createCodeNumpad('', authId);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
  };

  /**
   * Confirms verification code and completes authentication
   */
  const handleConfirmVerificationCode = async (ctx) => {
    const userId = ctx.from.id;
    const { authId, authSession } = findAuthSession(userId, 'code');

    if (!authSession) {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    if (!authSession.code || authSession.code.length < 5) {
      await ctx.answerCbQuery('❌ Please enter all 5 digits of the code', { show_alert: true });
      return;
    }

    if (authSession.verifying) {
      await ctx.answerCbQuery('⏳ Already verifying...', { show_alert: false });
      return;
    }
    authSession.verifying = true;

    if (!authSession.phoneCodeHash) {
      await ctx.editMessageText(
        '❌ <b>Session error</b>\n\nPhone verification was not completed. Please start again.',
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
      authSessions.delete(authId);
      return;
    }

    try {
      await ctx.editMessageText(
        `📱 <b>Authenticating...</b>\n\nPhone: <code>${authSession.phone}</code>\nCode: <code>${authSession.code}</code>\n\n🔄 Authenticating with Telegram...`,
        { parse_mode: 'HTML' }
      );

      const client = authSession.client;

      // Try to sign in with verification code
      try {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: authSession.phone,
            phoneCodeHash: authSession.phoneCodeHash,
            phoneCode: authSession.code
          })
        );

        // If we reach here, no 2FA required - authentication successful!
        const me = await client.getMe();
        const sessionString = client.session.save();

        // Update admin with phone number
        await updateAdminUseCase.execute(ctx.from.id.toString(), {
          phone: authSession.phone
        });

        // Save session via use case
        const result = await createSessionUseCase.execute({
          adminId: ctx.from.id.toString(),
          sessionString: sessionString,
          status: 'active'
        });

        // Notify parent controller to start UserBot
        if (onSessionCreated) {
          await onSessionCreated(ctx.from.id.toString(), result.session);
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
        authSessions.delete(authId);

        logger.info('Session added successfully (no 2FA)', { phone: authSession.phone, userId: me.id });

      } catch (signInError) {
        // Check if 2FA is required
        if (signInError.errorMessage === 'SESSION_PASSWORD_NEEDED' ||
            signInError.message?.includes('SESSION_PASSWORD_NEEDED') ||
            signInError.message === 'PASSWORD_REQUIRED' ||
            signInError.className === 'SessionPasswordNeededError') {
          
          logger.info('2FA required - requesting password', { phone: authSession.phone });

          // Move to 2FA password step
          authSession.step = 'password';
          authSession.password = '';
          authSession.waitingForPasswordMessage = true;

          const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
                       `Phone: <code>${authSession.phone}</code>\n` +
                       `Code verified! ✅\n\n` +
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

          return; // Wait for password message
        }

        // If it's not a 2FA error, show error message
        logger.error('Sign in failed (not 2FA)', signInError);

        const errorCode = signInError.errorMessage || signInError.message || '';

        if (errorCode.includes('PHONE_CODE_INVALID') || errorCode.includes('PHONE_CODE_EXPIRED')) {
          // Wrong/expired code — let user try again without restarting the whole flow
          authSession.code = '';
          authSession.verifying = false;

          const errLabel = errorCode.includes('EXPIRED')
            ? '⏰ Code expired. Request a new code.'
            : '❌ Wrong code. Please try again.';

          const retryKeyboard = errorCode.includes('EXPIRED')
            ? Markup.inlineKeyboard([
                [Markup.button.callback('� Resend code', `resend_code_${authId}`)],
                [Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)],
              ])
            : createCodeNumpad('', authId);

          await ctx.editMessageText(
            `📱 <b>Verification Code</b>\n\nPhone: <code>${authSession.phone}</code>\n\n${errLabel}\n\nCurrent: <code></code>\n\nEnter the verification code:`,
            { parse_mode: 'HTML', ...retryKeyboard }
          );
          return;
        }

        await ctx.editMessageText(
          `❌ <b>Authentication Failed</b>\n\n${errorCode}\n\nPlease try again.`,
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
        authSessions.delete(authId);
      }

    } catch (error) {
      logger.error('Unexpected error during verification', error);
      
      await ctx.editMessageText(
        `❌ <b>Unexpected Error</b>\n\n${error.message}\n\nPlease try again.`,
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
      authSessions.delete(authId);
    }
  };

  /**
   * Handles 2FA password text message
   */
  const handlePasswordTextMessage = async (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message?.text;

    if (!messageText) return;

    const { authId, authSession } = findAuthSession(userId, 'password', true);

    if (!authSession) return;

    // Delete user's password message for security
    try {
      await ctx.deleteMessage();
    } catch (error) {
      logger.warn('Could not delete password message', error);
    }

    authSession.password = messageText;
    authSession.waitingForPasswordMessage = false;

    try {
      await ctx.reply(
        `🔐 <b>Authenticating with 2FA...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Verifying 2FA password...`,
        { parse_mode: 'HTML' }
      );

      const client = authSession.client;

      // Get password SRP parameters
      const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
      
      // Compute password check
      const passwordCheck = await computeCheck(
        passwordSrpResult,
        authSession.password
      );

      // Authenticate with 2FA password
      await client.invoke(
        new Api.auth.CheckPassword({
          password: passwordCheck
        })
      );

      const me = await client.getMe();
      const sessionString = client.session.save();

      // Update admin with phone number
      await updateAdminUseCase.execute(ctx.from.id.toString(), {
        phone: authSession.phone
      });

      // Save session via use case
      const result = await createSessionUseCase.execute({
        adminId: ctx.from.id.toString(),
        sessionString: sessionString,
        status: 'active'
      });

      // Notify parent controller to start UserBot
      if (onSessionCreated) {
        await onSessionCreated(ctx.from.id.toString(), result.session);
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
      authSessions.delete(authId);

      logger.info('Session added via 2FA', { phone: authSession.phone, userId: me.id });

    } catch (error) {
      logger.error('Error during 2FA authentication', error);

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
      authSessions.delete(authId);
    }
  };

  /**
   * Cancels authentication process
   */
  /**
   * Resends verification code using Telegram's ResendCode API (does not count as new SMS request)
   */
  const handleResendCode = async (ctx, authId) => {
    const authSession = authSessions.get(authId);

    if (!authSession || authSession.step !== 'code') {
      await ctx.editMessageText('❌ Authentication session expired. Please start again.');
      return;
    }

    try {
      await ctx.editMessageText(
        `📱 <b>Resending code...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Requesting new verification code...`,
        { parse_mode: 'HTML' }
      );

      const result = await authSession.client.invoke(
        new Api.auth.ResendCode({
          phoneNumber: authSession.phone,
          phoneCodeHash: authSession.phoneCodeHash,
        })
      );

      // Update phoneCodeHash with the new one
      authSession.phoneCodeHash = result.phoneCodeHash;
      authSession.code = '';
      authSession.verifying = false;

      const keyboard = createCodeNumpad('', authId);
      await ctx.editMessageText(
        `📱 <b>Verification Code</b>\n\nPhone: <code>${authSession.phone}</code>\nNew code sent!\n\nCurrent: <code></code>\n\nEnter the verification code:`,
        { parse_mode: 'HTML', ...keyboard }
      );

      logger.info('Verification code resent successfully', { phone: authSession.phone });
    } catch (error) {
      logger.error('Failed to resend code', error);
      await ctx.editMessageText(
        `❌ Failed to resend code: ${error.message}\n\nPlease try again from the beginning.`,
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
    }
  };

  const handleCancelAuth = async (ctx, authId) => {
    const authSession = authSessions.get(authId);

    if (authSession?.client) {
      try {
        await authSession.client.disconnect();
      } catch (error) {
        logger.warn('Error disconnecting client during cancel', error);
      }
    }

    authSessions.delete(authId);

    await ctx.editMessageText('❌ Session authentication cancelled.', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
  };

  /**
   * Cleans up expired authentication sessions
   */
  const cleanupExpiredSessions = () => {
    const now = Date.now();
    const expireTime = 10 * 60 * 1000; // 10 minutes

    for (const [authId, session] of authSessions.entries()) {
      if (now - session.startTime > expireTime) {
        if (session.client) {
          try {
            session.client.disconnect();
          } catch (error) {
            logger.warn('Error disconnecting expired client', error);
          }
        }
        authSessions.delete(authId);
        logger.info('Cleaned up expired auth session', { authId });
      }
    }
  };

  return {
    handleStartPhoneInput,
    handlePhoneDigit,
    handlePhoneBackspace,
    handleConfirmPhoneNumber,
    handleCodeDigit,
    handleCodeBackspace,
    handleCodeClear,
    handleConfirmVerificationCode,
    handlePasswordTextMessage,
    handleCancelAuth,
    handleResendCode,
    cleanupExpiredSessions,
  };
}

/**
 * Finds authentication session for user
 * @private
 */
function findAuthSession(userId, step, checkWaitingForPassword = false) {
  for (const [id, session] of authSessions.entries()) {
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
 */
function createPhoneNumpad(currentNumber, authId) {
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
 */
function createCodeNumpad(currentCode, authId) {
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
