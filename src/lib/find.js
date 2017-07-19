'use strict';

/**
 * @module find
 */

/**
 * Iterates through an array of items, calls the `testFn` function passing in each item
 * individually as the first argument, and returns the first value for which `testFn`
 * returns a "truthy" value (literally `true` or a value that evaluates to `true`).
 *
 * @param arr {Array} the array to search through
 * @param testFn {function} a function that returns a "truthy" value for the item you
 * you want to find
 * @return {*} the first item that `testFn` returns a "truthy" value for
 */
module.exports = function(arr, testFn) {
   var i;

   if (!Array.isArray(arr) || !testFn || (typeof testFn !== 'function')) {
      return undefined;
   }

   for (i = 0; i < arr.length; i++) {
      if (testFn(arr[i])) {
         return arr[i];
      }
   }
   return undefined;
};
