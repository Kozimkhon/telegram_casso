/**
 * Mock Telegram Services
 * Provides mock implementations of Telegraf and GramJS clients
 */

let errorToThrow = null;
let errorCondition = null;
let errorDuration = null;
let callCount = 0;

function mockTelegramError(errorType, condition = null, duration = null, onCall = null) {
  errorToThrow = errorType;
  errorCondition = condition;
  errorDuration = duration || 30;
  callCount = 0;
}

function mockSuccessfulForward() {
  errorToThrow = null;
  errorCondition = null;
  callCount = 0;
}

function resetMocks() {
  errorToThrow = null;
  errorCondition = null;
  errorDuration = null;
  callCount = 0;
}

const mockTelegrafBot = {
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
  editMessageText: jest.fn().mockResolvedValue({ message_id: 1 })
};

// Add methods that return self
mockTelegrafBot.command = jest.fn().mockReturnValue(mockTelegrafBot);
mockTelegrafBot.hears = jest.fn().mockReturnValue(mockTelegrafBot);
mockTelegrafBot.action = jest.fn().mockReturnValue(mockTelegrafBot);
mockTelegrafBot.on = jest.fn().mockReturnValue(mockTelegrafBot);
mockTelegrafBot.use = jest.fn().mockReturnValue(mockTelegrafBot);
mockTelegrafBot.catch = jest.fn().mockReturnValue(mockTelegrafBot);

const mockTelegramClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn(async (peerId, message) => {
    callCount++;
    if (errorToThrow && (!errorCondition || errorCondition(callCount))) {
      const error = new Error(errorToThrow);
      error.errorMessage = errorToThrow;
      if (errorToThrow === 'FloodWait') {
        error.seconds = errorDuration || 30;
      }
      throw error;
    }
    return { id: Math.random() * 1000000 };
  }),
  getDialogs: jest.fn().mockResolvedValue([]),
  getMessages: jest.fn().mockResolvedValue([]),
  iterMessages: jest.fn(async function* () {
    yield { id: 1, message: 'Test message' };
  })
};

module.exports = {
  mockTelegramError,
  mockSuccessfulForward,
  resetMocks,
  mockTelegrafBot,
  mockTelegramClient
};
