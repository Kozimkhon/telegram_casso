/**
 * @fileoverview Base Repository Interface
 * Contract for all repository implementations
 * @module core/interfaces/IRepository
 */

/**
 * Base Repository Interface
 * Defines common CRUD operations
 * 
 * @interface IRepository
 * @template T
 */
class IRepository {
  /**
   * Finds entity by ID
   * @abstract
   * @param {string} id - Entity ID
   * @returns {Promise<T|null>} Entity or null
   */
  async findById(id) {
    throw new Error('findById() must be implemented');
  }

  /**
   * Finds all entities
   * @abstract
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Array<T>>} Array of entities
   */
  async findAll(filters = {}) {
    throw new Error('findAll() must be implemented');
  }

  /**
   * Creates new entity
   * @abstract
   * @param {T} entity - Entity to create
   * @returns {Promise<T>} Created entity
   */
  async create(entity) {
    throw new Error('create() must be implemented');
  }

  /**
   * Updates existing entity
   * @abstract
   * @param {string} id - Entity ID
   * @param {Partial<T>} updates - Updates to apply
   * @returns {Promise<T>} Updated entity
   */
  async update(id, updates) {
    throw new Error('update() must be implemented');
  }

  /**
   * Deletes entity
   * @abstract
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    throw new Error('delete() must be implemented');
  }

  /**
   * Checks if entity exists
   * @abstract
   * @param {string} id - Entity ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    throw new Error('exists() must be implemented');
  }

  /**
   * Counts entities
   * @abstract
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<number>} Entity count
   */
  async count(filters = {}) {
    throw new Error('count() must be implemented');
  }
}

export default IRepository;
