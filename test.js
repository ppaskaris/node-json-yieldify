'use strict';

const Async = require('async');
const expect = require('chai').expect;
const JsonYieldify = require('./index');

describe('mimics native stringify', () => {

  function test(value, cb) {
    JsonYieldify.stringify(value, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(value));
      cb();
    });
  }

  function testAll(values, cb) {
    Async.each(test, values, cb);
  }

  it('handles undefined', (cb) => {
    test(undefined, cb);
  });

  it('handles null', (cb) => {
    test(null, cb);
  });

  it('handles strings', (cb) => {
    testAll(['', 'greetings', '\0', '\n'], cb);
  });

  it('handles numbers', (cb) => {
    testAll([0, 42, -0, 6e40, -10e-20, Infinity, -Infinity, NaN], cb);
  });

  it('handles dates', (cb) => {
    test(new Date(), cb);
  });

  it('handles arrays', (cb) => {
    testAll([[], [42], ['greetings', undefined, 42]], cb);
  });

  it('handles objects', (cb) => {
    testAll([{}, { a: 42 }, { a: 'greetings', b: undefined, c: 42 }], cb);
  });

});

describe('yields to io', () => {

  let tag = 0;
  let inProgress = false;
  const FACTOR = Math.pow(2, 31) - 1;

  function gibberish() {
    return (
      ((Math.random() * FACTOR) << 0).toString(16) +
      ((Math.random() * FACTOR) << 0).toString(16) +
      ((Math.random() * FACTOR) << 0).toString(16) +
      ((Math.random() * FACTOR) << 0).toString(16)
    );
  }

  class TestValue {
    constructor() {
      this._value = gibberish();
    }
    toJSON() {
      tag += 1;
      return this._value;
    }
  }

  function incr() {
    tag += 1;
    if (inProgress) {
      setImmediate(incr);
    }
  }

  function test(value, discrepancy, cb) {
    tag = 0;
    inProgress = false;
    const syncJson = JSON.stringify(value);
    const syncTag = tag;
    tag = 0;
    inProgress = true;
    process.nextTick(incr);
    JsonYieldify.stringify(value, (err, JsonYieldify) => {
      inProgress = false;
      const asyncTag = tag;
      expect(err).to.not.exist;
      expect(JsonYieldify).to.equal(syncJson);
      expect(asyncTag).to.be.at.least(syncTag + discrepancy);
      cb();
    });
  }

  it('is asynchronous', (cb) => {
    test(new TestValue(), 1, cb);
  });

  it('handles enormous arrays', (cb) => {
    const array = [];
    for (let i = 0; i < 250000; ++i) {
      array[i] = new TestValue();
    }
    test(array, 100, cb);
  });

  it('handles enormous objects', (cb) => {
    const object = {};
    for (let i = 0; i < 250000; ++i) {
      object[`key:${i}:${gibberish()}`] = new TestValue();
    }
    test(object, 100, cb);
  });

  it('handles goofy nested values', (cb) => {
    function goofyObject(factory) {
      const object = {};
      for (let i = 0; i < 5; ++i) {
        object[`key:${i}:${gibberish()}`] = factory();
      }
      return object;
    }
    function goofyArray(factory) {
      const array = [];
      for (let i = 0; i < 5; ++i) {
        array[i] = factory();
      }
      return array;
    }
    let factory = () => new TestValue();
    for (let i = 0; i < 5; ++i) {
      if (i % 2) {
        factory = ((bound) => () => goofyArray(bound))(factory);
      } else {
        factory = ((bound) => () => goofyObject(bound))(factory);
      }
    }
    test(goofyArray(factory), 10, cb);
  });
});