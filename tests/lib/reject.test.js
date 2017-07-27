'use strict';

var expect = require('expect.js'),
    _ = require('underscore'),
    reject = require('../../src/lib/reject');

function rejectA(val) {
   return val === 'a';
}

function expectEmptyArray(arr) {
   expect(arr).to.be.an('array');
   expect(arr).to.be.empty();
}

describe('reject', function() {
   it('returns an empty array when given a non-array parameter to filter', function() {
      function returnFalse() {
         return false;
      }

      // When second parameter is a valid function
      expectEmptyArray(reject(undefined, returnFalse));
      expectEmptyArray(reject(null, returnFalse));
      expectEmptyArray(reject(false, returnFalse));
      expectEmptyArray(reject({}, returnFalse));

      // When second parameter is not a valid function
      expectEmptyArray(reject(undefined, undefined));
      expectEmptyArray(reject(null, undefined));
      expectEmptyArray(reject(false, undefined));
      expectEmptyArray(reject({}, undefined));
   });

   it('returns an empty array when given a non-function parameter to use', function() {
      expectEmptyArray(reject([ 'a' ], undefined));
      expectEmptyArray(reject([ 'a' ], 'a'));
      expectEmptyArray(reject([ 'a' ], {}));
   });

   it('returns an empty array when given a blank array to filter', function() {
      expectEmptyArray(reject([], _.noop));
   });

   it('returns an array excluding values for which the filter function returns a truthy value', function() {
      var objArray, result;

      result = reject([ 'a', 'b', 'a', 'c', 'a' ], rejectA);
      expect(result).to.have.length(2);
      expect(result[0]).to.be('b');
      expect(result[1]).to.be('c');

      function rejectTruthy(val) {
         return val.value;
      }
      objArray = [
         { id: 1, value: null },
         { id: 2, value: 'a' },
         { id: 3, value: undefined },
         { id: 4, value: true },
         { id: 5, value: false },
      ];

      result = reject(objArray, rejectTruthy);
      expect(result).to.have.length(3);
      expect(result[0].id).to.be(1);
      expect(result[1].id).to.be(3);
      expect(result[2].id).to.be(5);
   });

   it('returns a new array', function() {
      var arr = [ 'b' ],
          emptyArray = [];

      expect(reject(arr, rejectA)).to.not.equal(arr);
      expect(reject(emptyArray, rejectA)).to.not.equal(emptyArray);
   });
});
