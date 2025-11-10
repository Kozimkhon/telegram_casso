/**
 * Core Module Exports
 * Central export point for all core modules
 * 
 * @module core
 */

// Entities
export * from './entities/index.js';

// State Management
export { default as AppState } from './state/AppState.js';

// Dependency Injection
export { default as Container } from './di/Container.js';

// Use Cases
export { BaseUseCase } from './use-cases/BaseUseCase.js';
export { ManageChannelUseCase } from './use-cases/ManageChannelUseCase.js';
export { ManageSessionUseCase } from './use-cases/ManageSessionUseCase.js';

// Interfaces
export { IRepository } from './interfaces/IRepository.js';
export { IChannelRepository } from './interfaces/IChannelRepository.js';
export { ISessionRepository } from './interfaces/ISessionRepository.js';
export { IUserRepository } from './interfaces/IUserRepository.js';
