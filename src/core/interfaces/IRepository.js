/**
 * Repository Interface
 * Base interface for all repositories following the Repository pattern
 * 
 * @module core/interfaces/IRepository
 */

/**
 * @interface IRepository
 * @template T
 * @description Base repository interface defining common CRUD operations
 * All repositories should implement this interface for consistency
 */
export class IRepository {
  /**
   * Finds an entity by its ID
   * @param {string} id - Entity ID
   * @returns {Promise<T|null>} Entity or null if not found
   * @abstract
   */
  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  /**
   * Finds all entities with optional filtering
   * @param {Object} [filter] - Optional filter criteria
   * @returns {Promise<Array<T>>} Array of entities
   * @abstract
   */
  async findAll(filter = {}) {
    throw new Error('Method findAll() must be implemented');
  }

  /**
   * Creates a new entity
   * @param {Object} data - Entity data
   * @returns {Promise<T>} Created entity
   * @abstract
   */
  async create(data) {
    throw new Error('Method create() must be implemented');
  }

  /**
   * Updates an existing entity
   * @param {string} id - Entity ID
   * @param {Object} data - Update data
   * @returns {Promise<T>} Updated entity
   * @abstract
   */
  async update(id, data) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Deletes an entity
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} True if deleted
   * @abstract
   */
  async delete(id) {
    throw new Error('Method delete() must be implemented');
  }

  /**
   * Checks if entity exists
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} True if exists
   * @abstract
   */
  async exists(id) {
    throw new Error('Method exists() must be implemented');
  }

  /**
   * Counts entities with optional filtering
   * @param {Object} [filter] - Optional filter criteria
   * @returns {Promise<number>} Count of entities
   * @abstract
   */
  async count(filter = {}) {
    throw new Error('Method count() must be implemented');
  }
}

export default IRepository;
