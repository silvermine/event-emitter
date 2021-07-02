'use strict';

/**
 * @module isArrayOfStrings
 */

/**
 * @param o {any} the object to check
 * @return {boolean} `true` if the `o` parameter is an array and every element in the
 * array is a string. Returns false if the array is empty.
 */
module.exports = function(o) {
   function reducer(memo, item) {
      return memo && typeof item === 'string';
   }

   return Array.isArray(o) && o.length > 0 && o.reduce(reducer, true);
};
