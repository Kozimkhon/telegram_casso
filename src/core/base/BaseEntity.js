/**
 * @fileoverview Base Entity Class
 * Foundation for all domain entities
 * @module core/base/BaseEntity
 */

/**
 * Abstract Base Entity
 * All domain entities must extend this class
 * 
 * @abstract
 * @class BaseEntity
 * 
 * @example
 * class Channel extends BaseEntity {
 *   constructor(data) {
 *     super();
 *     this.validate(data);
 *     Object.assign(this, data);
 *   }
 * }
 */
class BaseEntity {
  /**
   * Entity creation timestamp
   * @type {Date}
   */
  createdAt;

  /**
   * Entity last update timestamp
   * @type {Date}
   */
  updatedAt;

  /**
   * Validates entity data
   * Must be implemented by child classes
   * @abstract
   * @param {Object} data - Entity data
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    throw new Error('validate() must be implemented by child class');
  }

  /**
   * Converts entity to plain object for database storage
   * Must be implemented by child classes
   * @abstract
   * @returns {Object} Plain object representation
   */
  toObject() {
    throw new Error('toObject() must be implemented by child class');
  }

  /**
   * Creates entity from database row
   * Must be implemented by child classes as static method
   * @abstract
   * @static
   * @param {Object} row - Database row
   * @returns {BaseEntity} Entity instance
   */
  static fromDatabaseRow(row) {
    throw new Error('fromDatabaseRow() must be implemented by child class');
  }

  /**
   * Checks if entity is valid
   * @returns {boolean} True if valid
   */
  isValid() {
    try {
      this.validate(this);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clones the entity
   * @returns {BaseEntity} Cloned entity
   */
  clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  /**
   * Converts entity to JSON
   * @returns {string} JSON string
   */
  toJSON() {
    return JSON.stringify(this.toObject());
  }
}

export default BaseEntity;
