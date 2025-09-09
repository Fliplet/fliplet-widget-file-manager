/**
 * Native JavaScript utilities to replace lodash methods
 * These functions provide equivalent functionality to commonly used lodash methods
 */

window.FlipletFileManagerUtils = {
  /**
   * Safely get a nested property from an object
   * Replacement for _.get()
   * @param {Object} obj - The object to query
   * @param {string|Array} path - The path to the property (dot notation string or array of keys)
   * @param {*} [defaultValue] - The value returned if the path is not found
   * @returns {*} The resolved value or defaultValue
   */
  get: function(obj, path, defaultValue) {
    if (!obj || typeof obj !== 'object') {
      return defaultValue;
    }
    
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;
    
    for (let i = 0; i < keys.length; i++) {
      if (result == null || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[keys[i]];
    }
    
    return result === undefined ? defaultValue : result;
  },

  /**
   * Find first element matching predicate
   * Replacement for _.find()
   * @param {Array} array - The array to search
   * @param {Function|Object|*} predicate - The function, object, or value to test each element
   * @returns {*} The first matching element or undefined
   */
  find: function(array, predicate) {
    if (typeof predicate === 'function') {
      return array.find(predicate);
    }
    if (Array.isArray(predicate)) {
      // Handle case like _.find(array, ['id', value])
      const [key, value] = predicate;
      return array.find(item => item[key] === value);
    }
    if (typeof predicate === 'object') {
      return array.find(item => {
        for (let key in predicate) {
          if (predicate.hasOwnProperty(key) && item[key] !== predicate[key]) {
            return false;
          }
        }
        return true;
      });
    }
    return array.find(item => item === predicate);
  },

  /**
   * Sort array by property or function
   * Replacement for _.sortBy()
   * @param {Array} array - The array to sort
   * @param {Function|Array} iteratee - The iteratee function, property path, or array of iteratees
   * @returns {Array} A new sorted array
   */
  sortBy: function(array, iteratee) {
    if (Array.isArray(iteratee)) {
      // Handle case like _.sortBy(array, [function(o) { return o.name; }])
      const getter = iteratee[0];
      return [...array].sort((a, b) => {
        const valueA = getter(a);
        const valueB = getter(b);
        if (valueA < valueB) return -1;
        if (valueA > valueB) return 1;
        return 0;
      });
    }
    
    const getKey = typeof iteratee === 'function' ? iteratee : (item) => this.get(item, iteratee);
    return [...array].sort((a, b) => {
      const valueA = getKey(a);
      const valueB = getKey(b);
      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    });
  },

  /**
   * Remove elements from array that match predicate
   * Replacement for _.remove()
   * @param {Array} array - The array to modify
   * @param {Function} predicate - The function to test each element
   * @returns {Array} The array of removed elements
   */
  remove: function(array, predicate) {
    const removed = [];
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        removed.unshift(array.splice(i, 1)[0]);
      }
    }
    return removed;
  },

  /**
   * Map array to new array
   * Replacement for _.map()
   * @param {Array} array - The array to map
   * @param {Function} iteratee - The function to call for each element
   * @returns {Array} A new mapped array
   */
  map: function(array, iteratee) {
    if (!array || !Array.isArray(array)) {
      return [];
    }
    if (typeof iteratee !== 'function') {
      throw new Error('FlipletFileManagerUtils.map: iteratee must be a function');
    }
    return array.map(iteratee);
  },

  /**
   * Iterate over collection
   * Replacement for _.forEach()
   * @param {Array|Object} collection - The collection to iterate over
   * @param {Function} iteratee - The function to call for each element
   */
  forEach: function(collection, iteratee) {
    if (Array.isArray(collection)) {
      collection.forEach(iteratee);
    } else if (collection && typeof collection === 'object') {
      Object.keys(collection).forEach(key => iteratee(collection[key], key));
    }
  },

  /**
   * Get last element of array
   * Replacement for _.last()
   * @param {Array} array - The array to query
   * @returns {*} The last element of the array
   */
  last: function(array) {
    return array[array.length - 1];
  },

  /**
   * Convert value to number
   * Replacement for _.toNumber()
   * @param {*} value - The value to convert
   * @returns {number} The converted number
   */
  toNumber: function(value) {
    if (value == null) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Simple debounce implementation
   * Replacement for _.debounce()
   * @param {Function} func - The function to debounce
   * @param {number} wait - The number of milliseconds to delay
   * @returns {Function} The debounced function
   */
  debounce: function(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
}; 