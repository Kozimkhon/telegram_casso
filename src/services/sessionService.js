/**
 * Session Service - manages userbot sessions with status tracking and auto-pause
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError } from '../utils/errorHandler.js';

/**
 * Adds or updates a session in the database
 * @param {Object} sessionData - Session information
 * @returns {Promise<Object>} Created/updated session
 */
export async function saveSession(sessionData) {
  const {
    phone,
    userId = null,
    sessionString = '',
    status = 'active',
    firstName = null,
    lastName = null,
    username = null
  } = sessionData;

  try {
    log.debug('[Session] Saving session', { phone, userId, status });

    // Check if session exists
    const existing = await getQuery(
      'SELECT * FROM sessions WHERE phone = ?',
      [phone]
    );

    if (existing) {
      // Update existing session
      await runQuery(
        `UPDATE sessions SET 
          user_id = ?, 
          session_string = ?, 
          status = ?,
          first_name = ?,
          last_name = ?,
          username = ?,
          last_active = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE phone = ?`,
        [userId, sessionString, status, firstName, lastName, username, phone]
      );
      
      log.info('[Session] Updated existing session', { phone });
    } else {
      // Insert new session
      await runQuery(
        `INSERT INTO sessions (phone, user_id, session_string, status, first_name, last_name, username, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [phone, userId, sessionString, status, firstName, lastName, username]
      );
      
      log.info('[Session] Created new session', { phone });
    }

    return await getSessionByPhone(phone);
  } catch (error) {
    throw handleDatabaseError(error, 'saveSession');
  }
}

/**
 * Gets a session by phone number
 * @param {string} phone - Phone number
 * @returns {Promise<Object|null>} Session data
 */
export async function getSessionByPhone(phone) {
  try {
    const session = await getQuery(
      'SELECT * FROM sessions WHERE phone = ?',
      [phone]
    );
    return session || null;
  } catch (error) {
    throw handleDatabaseError(error, 'getSessionByPhone');
  }
}

/**
 * Gets all sessions
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of sessions
 */
export async function getAllSessions(filters = {}) {
  try {
    const { status } = filters;
    
    let query = 'SELECT * FROM sessions';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const sessions = await getAllQuery(query, params);
    return sessions;
  } catch (error) {
    throw handleDatabaseError(error, 'getAllSessions');
  }
}

/**
 * Updates session status
 * @param {string} phone - Phone number
 * @param {string} status - New status (active/paused/error)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated session
 */
export async function updateSessionStatus(phone, status, metadata = {}) {
  const {
    autoPaused = false,
    pauseReason = null,
    floodWaitUntil = null,
    lastError = null
  } = metadata;

  try {
    log.info('[Session] Updating status', { phone, status, autoPaused, pauseReason });

    await runQuery(
      `UPDATE sessions SET 
        status = ?,
        auto_paused = ?,
        pause_reason = ?,
        flood_wait_until = ?,
        last_error = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE phone = ?`,
      [status, autoPaused ? 1 : 0, pauseReason, floodWaitUntil, lastError, phone]
    );

    return await getSessionByPhone(phone);
  } catch (error) {
    throw handleDatabaseError(error, 'updateSessionStatus');
  }
}

/**
 * Auto-pauses a session due to spam/flood detection
 * @param {string} phone - Phone number
 * @param {string} reason - Reason for auto-pause
 * @param {Date} floodWaitUntil - When flood wait expires (optional)
 * @returns {Promise<Object>} Updated session
 */
export async function autoPauseSession(phone, reason, floodWaitUntil = null) {
  try {
    log.warn('[Session] Auto-pausing session', { phone, reason, floodWaitUntil });

    return await updateSessionStatus(phone, 'paused', {
      autoPaused: true,
      pauseReason: reason,
      floodWaitUntil: floodWaitUntil ? floodWaitUntil.toISOString() : null,
      lastError: reason
    });
  } catch (error) {
    throw handleDatabaseError(error, 'autoPauseSession');
  }
}

/**
 * Resumes a paused session
 * @param {string} phone - Phone number
 * @returns {Promise<Object>} Updated session
 */
export async function resumeSession(phone) {
  try {
    log.info('[Session] Resuming session', { phone });

    return await updateSessionStatus(phone, 'active', {
      autoPaused: false,
      pauseReason: null,
      floodWaitUntil: null,
      lastError: null
    });
  } catch (error) {
    throw handleDatabaseError(error, 'resumeSession');
  }
}

/**
 * Marks a session as having an error
 * @param {string} phone - Phone number
 * @param {string} error - Error message
 * @returns {Promise<Object>} Updated session
 */
export async function markSessionError(phone, error) {
  try {
    log.error('[Session] Marking session error', { phone, error });

    return await updateSessionStatus(phone, 'error', {
      lastError: error
    });
  } catch (error) {
    throw handleDatabaseError(error, 'markSessionError');
  }
}

/**
 * Updates session activity timestamp
 * @param {string} phone - Phone number
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(phone) {
  try {
    await runQuery(
      'UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE phone = ?',
      [phone]
    );
  } catch (error) {
    log.debug('[Session] Failed to update activity', { phone, error: error.message });
  }
}

/**
 * Deletes a session
 * @param {string} phone - Phone number
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteSession(phone) {
  try {
    log.info('[Session] Deleting session', { phone });

    const result = await runQuery(
      'DELETE FROM sessions WHERE phone = ?',
      [phone]
    );

    return result.changes > 0;
  } catch (error) {
    throw handleDatabaseError(error, 'deleteSession');
  }
}

/**
 * Gets sessions that are ready to resume (flood wait expired)
 * @returns {Promise<Array>} Sessions ready to resume
 */
export async function getSessionsReadyToResume() {
  try {
    const sessions = await getAllQuery(
      `SELECT * FROM sessions 
      WHERE status = 'paused' 
      AND auto_paused = 1 
      AND flood_wait_until IS NOT NULL 
      AND flood_wait_until < CURRENT_TIMESTAMP`,
      []
    );
    
    return sessions;
  } catch (error) {
    throw handleDatabaseError(error, 'getSessionsReadyToResume');
  }
}

export default {
  saveSession,
  getSessionByPhone,
  getAllSessions,
  updateSessionStatus,
  autoPauseSession,
  resumeSession,
  markSessionError,
  updateSessionActivity,
  deleteSession,
  getSessionsReadyToResume
};
