'use strict';

/**
 * @module reject
 */

/**
 * Filters an array of items, removing all elements for which the `testFn` function
 * returns a "truthy" value (literally `true` or a value that evaluates to `true`).
 *
 * @param arr {Array} the array to filter
 * @param testFn {function} a function that returns a "truthy" value for the items you
 * want to reject from the Array
 * @return {Array} the filtered array
 */
module.exports = function(arr, testFn) {
   var targetArray = (arr || []);

   if (!Array.isArray(targetArray) || typeof testFn !== 'function') {
      return [];
   }
   return targetArray.filter(function(item) {
      return !testFn(item);
   });
};
