/**
 * @fileoverview Base TypeORM Repository
 * Generic repository with common CRUD operations
 * @module repositories/typeorm/BaseRepository
 */

/**
 * Base Repository
 * Provides generic CRUD operations for all entities
 * 
 * @template T
 * @class BaseRepository
 */
class BaseRepository {
  /**
   * TypeORM Repository
   * @protected
   */
  repository;

  /**
   * Entity name (for logging)
   * @protected
   */
  entityName;

  /**
   * Creates a base repository
   * @param {Repository<T>} repository - TypeORM repository
   * @param {string} entityName - Entity name for logging
   */
  constructor(repository, entityName) {
    this.repository = repository;
    this.entityName = entityName;
  }

  /**
   * Finds all records
   * @param {Object} [options] - Find options
   * @returns {Promise<T[]>} Records
   */
  async findAll(options = {}) {
    try {
      return await this.repository.find(options);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find all - ${error.message}`);
    }
  }

  /**
   * Finds record by ID
   * @param {number} id - Record ID
   * @param {Object} [options] - Find options
   * @returns {Promise<T|null>} Record or null
   */
  async findById(id, options = {}) {
    try {
      return await this.repository.findOne({
        where: { id },
        ...options,
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find by ID - ${error.message}`);
    }
  }

  /**
   * Finds record by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} [options] - Find options
   * @returns {Promise<T|null>} Record or null
   */
  async findOne(criteria, options = {}) {
    try {
      return await this.repository.findOne({
        where: criteria,
        ...options,
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find one - ${error.message}`);
    }
  }

  /**
   * Finds multiple records by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} [options] - Find options
   * @returns {Promise<T[]>} Records
   */
  async findMany(criteria, options = {}) {
    try {
      return await this.repository.find({
        where: criteria,
        ...options,
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find many - ${error.message}`);
    }
  }

  /**
   * Creates a new record
   * @param {Partial<T>} data - Record data
   * @returns {Promise<T>} Created record
   */
  async create(data) {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to create - ${error.message}`);
    }
  }

  /**
   * Updates a record
   * @param {number} id - Record ID
   * @param {Partial<T>} data - Update data
   * @returns {Promise<T|null>} Updated record or null
   */
  async update(id, data) {
    try {
      await this.repository.update(id, data);
      return await this.findById(id);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to update - ${error.message}`);
    }
  }

  /**
   * Deletes a record
   * @param {number} id - Record ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    try {
      const result = await this.repository.delete(id);
      return result.affected > 0;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to delete - ${error.message}`);
    }
  }

  /**
   * Counts records
   * @param {Object} [criteria] - Count criteria
   * @returns {Promise<number>} Record count
   */
  async count(criteria = {}) {
    try {
      return await this.repository.count({ where: criteria });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to count - ${error.message}`);
    }
  }

  /**
   * Checks if record exists
   * @param {Object} criteria - Search criteria
   * @returns {Promise<boolean>} True if exists
   */
  async exists(criteria) {
    try {
      const count = await this.repository.count({ where: criteria });
      return count > 0;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to check existence - ${error.message}`);
    }
  }

  /**
   * Saves a record (insert or update)
   * @param {T} entity - Entity to save
   * @returns {Promise<T>} Saved entity
   */
  async save(entity) {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to save - ${error.message}`);
    }
  }

  /**
   * Saves multiple records
   * @param {T[]} entities - Entities to save
   * @returns {Promise<T[]>} Saved entities
   */
  async saveMany(entities) {
    try {
      return await this.repository.save(entities);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to save many - ${error.message}`);
    }
  }

  /**
   * Executes a custom query
   * @param {string} query - SQL query
   * @param {Array} [params] - Query parameters
   * @returns {Promise<any>} Query result
   */
  async query(query, params = []) {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to execute query - ${error.message}`);
    }
  }
}

export default BaseRepository;
