/**
 * AdminBot Authentication Extensions
 * Provides UI for adding and authenticating new sessions through Telegram
 */

import { Markup } from 'telegraf';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { config } from '../config/index.js';
import { log } from '../utils/logger.js';
import { saveSession } from '../services/sessionService.js';

// Store temporary authentication states
const authSessions = new Map();

/**
 * Sets up session authentication commands and callbacks
 * @param {Object} bot - Telegraf bot instance
 * @param {Function} asyncErrorHandler - Error handler wrapper
 * @param {Object} userBotManager - UserBot manager instance
 */
export function setupSessionAuthentication(bot, asyncErrorHandler, userBotManager) {
  // Callback: Add new session - start phone number input
  bot.action('add_session', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await startPhoneInput(ctx);
  }, 'Add session callback'));

  // Phone number callbacks - numpad for phone
  bot.action(/^phone_(\d)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const digit = ctx.match[1];
    await handlePhoneDigit(ctx, digit);
  }, 'Phone digit callback'));

  bot.action('phone_plus', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlePhoneDigit(ctx, '+');
  }, 'Phone plus callback'));

  bot.action('phone_backspace', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlePhoneBackspace(ctx);
  }, 'Phone backspace callback'));

  bot.action('phone_confirm', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    // Run authentication asynchronously with error handling
    setImmediate(async () => {
      try {
        await confirmPhoneNumber(ctx);
      } catch (error) {
        log.error('Error in phone confirmation', error);
        try {
          await ctx.editMessageText(`❌ <b>Error</b>\n\nFailed to process phone confirmation: ${error.message}\n\nPlease try again.`, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          });
        } catch (editError) {
          log.error('Error editing message after phone confirmation error', editError);
        }
      }
    });
  }, 'Phone confirm callback'));

  // Verification code callbacks - numpad for code
  bot.action(/^code_(\d)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const digit = ctx.match[1];
    await handleCodeDigit(ctx, digit);
  }, 'Code digit callback'));

  bot.action('code_backspace', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handleCodeBackspace(ctx);
  }, 'Code backspace callback'));

  bot.action('code_confirm', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    // Run authentication asynchronously with error handling
    setImmediate(async () => {
      try {
        await confirmVerificationCode(ctx, userBotManager);
      } catch (error) {
        log.error('Error in code confirmation', error);
        try {
          await ctx.editMessageText(`❌ <b>Error</b>\n\nFailed to verify code: ${error.message}\n\nPlease try again.`, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          });
        } catch (editError) {
          log.error('Error editing message after code confirmation error', editError);
        }
      }
    });
  }, 'Code confirm callback'));

  // Password callbacks - numpad for 2FA password (if needed)
  bot.action(/^password_(\d)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const digit = ctx.match[1];
    await handlePasswordDigit(ctx, digit);
  }, 'Password digit callback'));

  bot.action('password_backspace', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlePasswordBackspace(ctx);
  }, 'Password backspace callback'));

  bot.action('password_letters', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlePasswordLetters(ctx);
  }, 'Password letters callback'));

  bot.action('password_numbers', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlePasswordNumbers(ctx);
  }, 'Password numbers callback'));

  bot.action(/^password_letter_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const letter = ctx.match[1];
    await handlePasswordLetter(ctx, letter);
  }, 'Password letter callback'));

  bot.action('password_confirm', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    // Run authentication asynchronously with error handling
    setImmediate(async () => {
      try {
        await confirmPassword(ctx, userBotManager);
      } catch (error) {
        log.error('Error in password confirmation', error);
        try {
          await ctx.editMessageText(`❌ <b>Error</b>\n\nFailed to verify 2FA password: ${error.message}\n\nPlease try again.`, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          });
        } catch (editError) {
          log.error('Error editing message after password confirmation error', editError);
        }
      }
    });
  }, 'Password confirm callback'));

  // Cancel authentication
  bot.action(/^cancel_auth_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const authId = ctx.match[1];
    await cancelAuth(ctx, authId);
  }, 'Cancel auth callback'));
}

/**
 * Creates a numpad keyboard for phone number input
 */
function createPhoneNumpad(currentNumber = '', authId) {
  const keyboard = [];
  
  // First row: 1, 2, 3
  keyboard.push([
    Markup.button.callback('1', 'phone_1'),
    Markup.button.callback('2', 'phone_2'),
    Markup.button.callback('3', 'phone_3')
  ]);
  
  // Second row: 4, 5, 6
  keyboard.push([
    Markup.button.callback('4', 'phone_4'),
    Markup.button.callback('5', 'phone_5'),
    Markup.button.callback('6', 'phone_6')
  ]);
  
  // Third row: 7, 8, 9
  keyboard.push([
    Markup.button.callback('7', 'phone_7'),
    Markup.button.callback('8', 'phone_8'),
    Markup.button.callback('9', 'phone_9')
  ]);
  
  // Fourth row: +, 0, ⌫
  keyboard.push([
    Markup.button.callback('+', 'phone_plus'),
    Markup.button.callback('0', 'phone_0'),
    Markup.button.callback('⌫', 'phone_backspace')
  ]);
  
  // Fifth row: Confirm and Cancel
  keyboard.push([
    Markup.button.callback('✅ Confirm', 'phone_confirm'),
    Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
  ]);
  
  return Markup.inlineKeyboard(keyboard);
}

/**
 * Creates a numpad keyboard for verification code input
 */
function createCodeNumpad(currentCode = '', authId) {
  const keyboard = [];
  
  // First row: 1, 2, 3
  keyboard.push([
    Markup.button.callback('1', 'code_1'),
    Markup.button.callback('2', 'code_2'),
    Markup.button.callback('3', 'code_3')
  ]);
  
  // Second row: 4, 5, 6
  keyboard.push([
    Markup.button.callback('4', 'code_4'),
    Markup.button.callback('5', 'code_5'),
    Markup.button.callback('6', 'code_6')
  ]);
  
  // Third row: 7, 8, 9
  keyboard.push([
    Markup.button.callback('7', 'code_7'),
    Markup.button.callback('8', 'code_8'),
    Markup.button.callback('9', 'code_9')
  ]);
  
  // Fourth row: ⌫, 0, Clear
  keyboard.push([
    Markup.button.callback('⌫', 'code_backspace'),
    Markup.button.callback('0', 'code_0'),
    Markup.button.callback('🗑️', 'code_clear')
  ]);
  
  // Fifth row: Confirm and Cancel
  keyboard.push([
    Markup.button.callback('✅ Confirm', 'code_confirm'),
    Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
  ]);
  
  return Markup.inlineKeyboard(keyboard);
}

/**
 * Starts phone number input process
 */
async function startPhoneInput(ctx) {
  const userId = ctx.from.id;
  const authId = `${userId}_${Date.now()}`;
  
  // Initialize auth session
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
}

/**
 * Handles phone number digit input
 */
async function handlePhoneDigit(ctx, digit) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'phone') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Add digit to phone number
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
}

/**
 * Handles phone number backspace
 */
async function handlePhoneBackspace(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'phone') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Remove last digit
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
}

/**
 * Confirms phone number and starts Telegram auth
 */
async function confirmPhoneNumber(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'phone') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  if (!authSession.phone || authSession.phone.length < 10) {
    await ctx.answerCbQuery('❌ Please enter a valid phone number', { show_alert: true });
    return;
  }
  
  try {
    // Show loading message
    await ctx.editMessageText(`📱 <b>Connecting...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Connecting to Telegram...`, {
      parse_mode: 'HTML'
    });
    
    // Create Telegram client
    const client = new TelegramClient(
      new StringSession(''),
      config.telegram.apiId,
      config.telegram.apiHash,
      { connectionRetries: 5 }
    );
    
    // Store client in session
    authSession.client = client;
    authSession.step = 'code';
    authSession.code = '';
    
    // Connect to Telegram
    await client.connect();
    
    // Send SMS verification code
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: authSession.phone,
        apiId: config.telegram.apiId,
        apiHash: config.telegram.apiHash,
        settings: new Api.CodeSettings({})
      })
    );
    
    // Store the phone code hash for later verification
    authSession.phoneCodeHash = result.phoneCodeHash;
    
    // Show code input interface
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
    
    log.info('SMS verification code sent successfully', { phone: authSession.phone });
    
  } catch (error) {
    log.error('Error sending verification code', error);
    await ctx.editMessageText(`❌ <b>Error</b>\n\nFailed to send verification code: ${error.message}\n\nPlease try again.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Try Again', callback_data: 'add_session' },
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
    
    // Clean up
    if (authSession.client) {
      await authSession.client.disconnect();
    }
    authSessions.delete(authId);
  }
}

/**
 * Handles verification code digit input
 */
async function handleCodeDigit(ctx, digit) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'code') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Add digit to code
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
}

/**
 * Handles verification code backspace
 */
async function handleCodeBackspace(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'code') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Remove last digit
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
}

/**
 * Confirms verification code and completes auth
 */
async function confirmVerificationCode(ctx, userBotManager) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'code') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  if (!authSession.code || authSession.code.length < 4) {
    await ctx.answerCbQuery('❌ Please enter a valid verification code', { show_alert: true });
    return;
  }
  
  try {
    // Show authenticating message
    await ctx.editMessageText(`📱 <b>Authenticating...</b>\n\nPhone: <code>${authSession.phone}</code>\nCode: <code>${authSession.code}</code>\n\n🔄 Authenticating with Telegram...`, {
      parse_mode: 'HTML'
    });
    
    const client = authSession.client;
    
    // Sign in with the verification code
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: authSession.phone,
        phoneCodeHash: authSession.phoneCodeHash,
        phoneCode: authSession.code
      })
    );
    
    // Get user info
    const me = await client.getMe();
    const sessionString = client.session.save();
    
    // Save session to database
    await saveSession({
      phone: authSession.phone,
      user_id: me.id.toString(),
      username: me.username || null,
      session_string: sessionString,
      status: 'active'
    });
    
    // Add to userbot manager
    if (userBotManager) {
      await userBotManager.addUserBot({
        phone: authSession.phone,
        user_id: me.id.toString(),
        session_string: sessionString,
        status: 'active'
      });
    }
    
    // Success message
    await ctx.editMessageText(`✅ <b>Session Added Successfully!</b>\n\nPhone: <code>${authSession.phone}</code>\nUser: <code>${me.firstName || ''} ${me.lastName || ''}</code>\nUsername: <code>@${me.username || 'N/A'}</code>\n\n🎉 Session is now active and ready!`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📋 View Sessions', callback_data: 'sessions_list' },
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
    
    // Clean up
    await client.disconnect();
    authSessions.delete(authId);
    
    log.info('Session added successfully via AdminBot', { phone: authSession.phone, userId: me.id });
    
  } catch (error) {
    log.error('Error during authentication', error);
    
    // Check if 2FA is required
    if (error.message === 'PASSWORD_REQUIRED' || 
        error.errorMessage === 'SESSION_PASSWORD_NEEDED' || 
        error.className === 'SessionPasswordNeededError' ||
        error.message.includes('SESSION_PASSWORD_NEEDED')) {
      // 2FA required
      authSession.step = 'password';
      authSession.password = '';
      
      const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
                   `Phone: <code>${authSession.phone}</code>\n` +
                   `2FA password required!\n\n` +
                   `Current: <code></code>\n\n` +
                   `Enter your 2FA password:`;
      
      const keyboard = createPasswordNumpad('', authId);
      
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard
      });
      
    } else {
      // Other error
      await ctx.editMessageText(`❌ <b>Authentication Failed</b>\n\n${error.message}\n\nPlease try again.`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Try Again', callback_data: 'add_session' },
            { text: '🏠 Main Menu', callback_data: 'main_menu' }
          ]]
        }
      });
      
      // Clean up
      if (authSession.client) {
        await authSession.client.disconnect();
      }
      authSessions.delete(authId);
    }
  }
}

/**
 * Creates a numpad keyboard for password input
 */
function createPasswordNumpad(currentPassword = '', authId) {
  const keyboard = [];
  
  // First row: 1, 2, 3
  keyboard.push([
    Markup.button.callback('1', 'password_1'),
    Markup.button.callback('2', 'password_2'),
    Markup.button.callback('3', 'password_3')
  ]);
  
  // Second row: 4, 5, 6
  keyboard.push([
    Markup.button.callback('4', 'password_4'),
    Markup.button.callback('5', 'password_5'),
    Markup.button.callback('6', 'password_6')
  ]);
  
  // Third row: 7, 8, 9
  keyboard.push([
    Markup.button.callback('7', 'password_7'),
    Markup.button.callback('8', 'password_8'),
    Markup.button.callback('9', 'password_9')
  ]);
  
  // Fourth row: ⌫, 0, letters
  keyboard.push([
    Markup.button.callback('⌫', 'password_backspace'),
    Markup.button.callback('0', 'password_0'),
    Markup.button.callback('ABC', 'password_letters')
  ]);
  
  // Fifth row: Confirm and Cancel
  keyboard.push([
    Markup.button.callback('✅ Confirm', 'password_confirm'),
    Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
  ]);
  
  return Markup.inlineKeyboard(keyboard);
}

/**
 * Handles password digit input
 */
async function handlePasswordDigit(ctx, digit) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Add digit to password
  authSession.password += digit;
  
  const maskedPassword = '*'.repeat(authSession.password.length);
  
  const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
               `Phone: <code>${authSession.phone}</code>\n` +
               `2FA password required!\n\n` +
               `Current: <code>${maskedPassword}</code>\n\n` +
               `Enter your 2FA password:`;
  
  const keyboard = createPasswordNumpad(authSession.password, authId);
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...keyboard
  });
}

/**
 * Handles password backspace
 */
async function handlePasswordBackspace(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Remove last character
  authSession.password = authSession.password.slice(0, -1);
  
  const maskedPassword = '*'.repeat(authSession.password.length);
  
  const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
               `Phone: <code>${authSession.phone}</code>\n` +
               `2FA password required!\n\n` +
               `Current: <code>${maskedPassword}</code>\n\n` +
               `Enter your 2FA password:`;
  
  const keyboard = createPasswordNumpad(authSession.password, authId);
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...keyboard
  });
}

/**
 * Handles password letter input
 */
async function handlePasswordLetter(ctx, letter) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  // Handle special characters
  let charToAdd = letter;
  if (letter === '_') charToAdd = ' '; // Space
  if (letter === '__') charToAdd = '_'; // Underscore
  
  // Add letter to password
  authSession.password += charToAdd;
  
  const maskedPassword = '*'.repeat(authSession.password.length);
  
  const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
               `Phone: <code>${authSession.phone}</code>\n` +
               `2FA password required!\n\n` +
               `Current: <code>${maskedPassword}</code>\n\n` +
               `Select letters for your password:`;
  
  const keyboard = createPasswordLettersKeyboard(authSession.password, authId);
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...keyboard
  });
}

/**
 * Handles password numbers - switches back to numpad
 */
async function handlePasswordNumbers(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  const maskedPassword = '*'.repeat(authSession.password.length);
  
  const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
               `Phone: <code>${authSession.phone}</code>\n` +
               `2FA password required!\n\n` +
               `Current: <code>${maskedPassword}</code>\n\n` +
               `Enter your 2FA password:`;
  
  const keyboard = createPasswordNumpad(authSession.password, authId);
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...keyboard
  });
}

/**
 * Handles password letters input - shows alphabet keyboard
 */
async function handlePasswordLetters(ctx) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  const maskedPassword = '*'.repeat(authSession.password.length);
  
  const text = `🔐 <b>Two-Factor Authentication</b>\n\n` +
               `Phone: <code>${authSession.phone}</code>\n` +
               `2FA password required!\n\n` +
               `Current: <code>${maskedPassword}</code>\n\n` +
               `Select letters for your password:`;
  
  const keyboard = createPasswordLettersKeyboard(authSession.password, authId);
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...keyboard
  });
}

/**
 * Creates a letters keyboard for password input
 */
function createPasswordLettersKeyboard(currentPassword = '', authId) {
  const keyboard = [];
  
  // First row: A-F
  keyboard.push([
    Markup.button.callback('A', 'password_letter_A'),
    Markup.button.callback('B', 'password_letter_B'),
    Markup.button.callback('C', 'password_letter_C'),
    Markup.button.callback('D', 'password_letter_D'),
    Markup.button.callback('E', 'password_letter_E'),
    Markup.button.callback('F', 'password_letter_F')
  ]);
  
  // Second row: G-L
  keyboard.push([
    Markup.button.callback('G', 'password_letter_G'),
    Markup.button.callback('H', 'password_letter_H'),
    Markup.button.callback('I', 'password_letter_I'),
    Markup.button.callback('J', 'password_letter_J'),
    Markup.button.callback('K', 'password_letter_K'),
    Markup.button.callback('L', 'password_letter_L')
  ]);
  
  // Third row: M-R
  keyboard.push([
    Markup.button.callback('M', 'password_letter_M'),
    Markup.button.callback('N', 'password_letter_N'),
    Markup.button.callback('O', 'password_letter_O'),
    Markup.button.callback('P', 'password_letter_P'),
    Markup.button.callback('Q', 'password_letter_Q'),
    Markup.button.callback('R', 'password_letter_R')
  ]);
  
  // Fourth row: S-X
  keyboard.push([
    Markup.button.callback('S', 'password_letter_S'),
    Markup.button.callback('T', 'password_letter_T'),
    Markup.button.callback('U', 'password_letter_U'),
    Markup.button.callback('V', 'password_letter_V'),
    Markup.button.callback('W', 'password_letter_W'),
    Markup.button.callback('X', 'password_letter_X')
  ]);
  
  // Fifth row: Y, Z, and special characters
  keyboard.push([
    Markup.button.callback('Y', 'password_letter_Y'),
    Markup.button.callback('Z', 'password_letter_Z'),
    Markup.button.callback('@', 'password_letter_@'),
    Markup.button.callback('.', 'password_letter_.'),
    Markup.button.callback('_', 'password_letter__'),
    Markup.button.callback('-', 'password_letter_-')
  ]);
  
  // Sixth row: Controls
  keyboard.push([
    Markup.button.callback('⌫', 'password_backspace'),
    Markup.button.callback('123', 'password_numbers'),
    Markup.button.callback('Space', 'password_letter_ ')
  ]);
  
  // Seventh row: Confirm and Cancel
  keyboard.push([
    Markup.button.callback('✅ Confirm', 'password_confirm'),
    Markup.button.callback('❌ Cancel', `cancel_auth_${authId}`)
  ]);
  
  return Markup.inlineKeyboard(keyboard);
}

/**
 * Confirms 2FA password and completes auth
 */
async function confirmPassword(ctx, userBotManager) {
  const userId = ctx.from.id;
  
  // Find the auth session
  let authId = null;
  let authSession = null;
  
  for (const [id, session] of authSessions.entries()) {
    if (session.userId === userId && session.step === 'password') {
      authId = id;
      authSession = session;
      break;
    }
  }
  
  if (!authSession) {
    await ctx.editMessageText('❌ Authentication session expired. Please start again.');
    return;
  }
  
  if (!authSession.password || authSession.password.length < 1) {
    await ctx.answerCbQuery('❌ Please enter your 2FA password', { show_alert: true });
    return;
  }
  
  try {
    // Show authenticating message
    await ctx.editMessageText(`🔐 <b>Authenticating with 2FA...</b>\n\nPhone: <code>${authSession.phone}</code>\n\n🔄 Verifying 2FA password...`, {
      parse_mode: 'HTML'
    });
    
    const client = authSession.client;
    
    // Check 2FA password
    const result = await client.invoke(
      new Api.auth.CheckPassword({
        password: await client.computeCheck(authSession.password)
      })
    );
    
    // Get user info
    const me = await client.getMe();
    const sessionString = client.session.save();
    
    // Save session to database
    await saveSession({
      phone: authSession.phone,
      user_id: me.id.toString(),
      username: me.username || null,
      session_string: sessionString,
      status: 'active'
    });
    
    // Add to userbot manager
    if (userBotManager) {
      await userBotManager.addUserBot({
        phone: authSession.phone,
        user_id: me.id.toString(),
        session_string: sessionString,
        status: 'active'
      });
    }
    
    // Success message
    await ctx.editMessageText(`✅ <b>Session Added Successfully!</b>\n\nPhone: <code>${authSession.phone}</code>\nUser: <code>${me.firstName || ''} ${me.lastName || ''}</code>\nUsername: <code>@${me.username || 'N/A'}</code>\n\n🎉 Session is now active and ready!`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📋 View Sessions', callback_data: 'sessions_list' },
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
    
    // Clean up
    await client.disconnect();
    authSessions.delete(authId);
    
    log.info('Session added successfully via AdminBot with 2FA', { phone: authSession.phone, userId: me.id });
    
  } catch (error) {
    log.error('Error during 2FA authentication', error);
    
    await ctx.editMessageText(`❌ <b>2FA Authentication Failed</b>\n\nIncorrect password. Please try again.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Try Again', callback_data: 'add_session' },
          { text: '🏠 Main Menu', callback_data: 'main_menu' }
        ]]
      }
    });
    
    // Clean up
    if (authSession.client) {
      await authSession.client.disconnect();
    }
    authSessions.delete(authId);
  }
}

/**
 * Cancels authentication process
 */
async function cancelAuth(ctx, authId) {
  const authSession = authSessions.get(authId);
  
  if (authSession && authSession.client) {
    try {
      await authSession.client.disconnect();
    } catch (error) {
      log.warn('Error disconnecting client during cancel', error);
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
}

/**
 * Cleanup expired authentication sessions
 */
export function cleanupExpiredAuthSessions() {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000; // 10 minutes
  
  for (const [authId, session] of authSessions.entries()) {
    if (now - session.startTime > expireTime) {
      if (session.client) {
        try {
          session.client.disconnect();
        } catch (error) {
          log.warn('Error disconnecting expired client', error);
        }
      }
      authSessions.delete(authId);
      log.info('Cleaned up expired auth session', { authId });
    }
  }
}