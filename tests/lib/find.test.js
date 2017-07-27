'use strict';

var expect = require('expect.js'),
    _ = require('underscore'),
    find = require('../../src/lib/find');


describe('find', function() {
   it('returns undefined when given a non array-like parameter to search through', function() {
      function returnTrue() {
         return true;
      }
      // When second parameter is a valid function
      expect(find(undefined, returnTrue)).to.be(undefined);
      expect(find(null, returnTrue)).to.be(undefined);
      expect(find(false, returnTrue)).to.be(undefined);
      expect(find({}, returnTrue)).to.be(undefined);

      // When second parameter is not a valid function
      expect(find(undefined, undefined)).to.be(undefined);
      expect(find(null, undefined)).to.be(undefined);
      expect(find(false, undefined)).to.be(undefined);
      expect(find({}, undefined)).to.be(undefined);
   });

   it('returns undefined when given a non-function parameter to use', function() {
      expect(find([ 'a' ], undefined)).to.be(undefined);
      expect(find([ 'a' ], 'a')).to.be(undefined);
      expect(find([ 'a' ], {})).to.be(undefined);
   });

   it('returns undefined when given a blank array to search through', function() {
      expect(find([], _.noop)).to.be(undefined);
   });

   it('returns undefined when no results return a truthy value from the test function', function() {
      expect(find([ 'a', 'b', 'c' ], _.noop)).to.be(undefined);
   });

   it('returns undefined when the test function returns false for each item', function() {
      function returnFalse() {
         return false;
      }
      expect(find([ 'a', 'b', 'c' ], returnFalse)).to.be(undefined);
   });

   it('returns the first item for which the test function returns a truthy value', function() {
      var objArray;

      function findA(val) {
         return val === 'a';
      }
      expect(find([ 'a', 'b', 'c' ], findA)).to.be('a');

      function findAObj(obj) {
         return obj.value === 'a';
      }
      objArray = [
         { id: 1, value: 'a' },
         { id: 2, value: 'a' },
         { id: 3, value: 'a' },
      ];

      // Test that `find` finds the first item when there is more than one match
      expect(find(objArray, findAObj)).to.be(objArray[0]);

      function findATruthy(val) {
         return val.value;
      }
      objArray = [
         { id: 1, value: null },
         { id: 2, value: 'a' },
         { id: 3, value: undefined },
      ];

      expect(find(objArray, findATruthy)).to.be(objArray[1]);
   });
});
