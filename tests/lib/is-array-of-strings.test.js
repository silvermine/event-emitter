'use strict';

var expect = require('expect.js'),
    isArrayOfStrings = require('../../src/lib/is-array-of-strings');

describe('isArrayOfStrings', function() {
   it('returns true when given object is an array of strings', function() {
      expect(isArrayOfStrings([ '' ])).to.be(true);
      expect(isArrayOfStrings([ '', 'a string' ])).to.be(true);
   });

   it('returns false when given object is an empty array', function() {
      expect(isArrayOfStrings([])).to.be(false);
   });

   it('returns false when given object is not an array', function() {
      expect(isArrayOfStrings(undefined)).to.be(false);
      expect(isArrayOfStrings(null)).to.be(false);
      expect(isArrayOfStrings(new Set([ '' ]))).to.be(false);
      expect(isArrayOfStrings(10)).to.be(false);
      expect(isArrayOfStrings({})).to.be(false);
      expect(isArrayOfStrings({ length: 1 })).to.be(false);
      expect(isArrayOfStrings(true)).to.be(false);
   });

   it('returns false when the array contains something that\'s not a string', function() {
      expect(isArrayOfStrings([ 'string', undefined ])).to.be(false);
      expect(isArrayOfStrings([ 'string', null, 'another string' ])).to.be(false);
      expect(isArrayOfStrings([ 1, 'string' ])).to.be(false);
      expect(isArrayOfStrings([ [ 'string' ], 'another string' ])).to.be(false);
      expect(isArrayOfStrings([ 'string', {}, 'another string' ])).to.be(false);
      expect(isArrayOfStrings([ 'string', true, 'another string' ])).to.be(false);
   });
});
