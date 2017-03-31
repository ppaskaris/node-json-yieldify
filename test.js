'use strict';

const Async = require('async');
const expect = require('chai').expect;
const JsonYieldify = require('./index');

const FACTOR = Math.pow(2, 31) - 1;

function gibberish() {
  return (
    ((Math.random() * FACTOR) << 0).toString(16) +
    ((Math.random() * FACTOR) << 0).toString(16) +
    ((Math.random() * FACTOR) << 0).toString(16) +
    ((Math.random() * FACTOR) << 0).toString(16)
  );
}

describe('native parity', () => {

  function test(value, cb) {
    JsonYieldify.stringify(value, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(value));
      cb();
    });
  }

  function testAll(values, cb) {
    Async.each(values, test, cb);
  }

  it('handles undefined', (cb) => {
    test(undefined, cb);
  });

  it('handles null', (cb) => {
    test(null, cb);
  });

  it('handles strings', (cb) => {
    testAll(['', 'greetings', '\0', '\n', new String('hello')], cb);
  });

  it('handles numbers', (cb) => {
    testAll([0, 42, -0, 6e40, Infinity, -Infinity, NaN, new Number(56)], cb);
  });

  it('handles booleans', (cb) => {
    testAll([true, false, new Boolean(true)], cb);
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

  function Greetings(message) {
    this.message = message;
    this.shout = message.toUpperCase() + '!';
  }

  it('handles constructors', (cb) => {
    test(new Greetings('hello'), cb);
  });

  const complexObject = {
    array: [1, 2, 3],
    string: 'greetings',
    number: 42,
    goofyNumbers: [0, -0, Infinity, -Infinity, NaN, 9e-56],
    other: {
      date: new Date(),
      nullValue: null,
      undefinedValue: undefined,
      arrayWithNullValue: [1, null, 3],
      arrayWithUndefinedValue: [1, undefined, 3]
    }
  };

  const complexArray = [
    [new Number(1), new String('hello'), new Boolean(56), new Date()],
    'greetings',
    42,
    [0, -0, Infinity, -Infinity, NaN, 9e-56],
    {
      date: new Date(),
      nullValue: null,
      undefinedValue: undefined,
      arrayWithNullValue: [1, null, 3],
      arrayWithUndefinedValue: [1, undefined, 3]
    }
  ];

  it('supports complex values', (cb) => {
    testAll([complexObject, complexArray], cb);
  });

  it('supports indent with spaces', (cb) => {
    JsonYieldify.stringify(complexObject, null, 2, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, null, 2));
      cb();
    });
  });

  it('indents at most 10 spaces', (cb) => {
    JsonYieldify.stringify(complexObject, null, 12, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, null, 12));
      cb();
    });
  });

  it('supports indent with string', (cb) => {
    JsonYieldify.stringify(complexObject, null, '\t', (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, null, '\t'));
      cb();
    });
  });

  const BIGSTR = 'pasghettipasghetti';

  it('indents at most 10 characters', (cb) => {
    JsonYieldify.stringify(complexObject, null, BIGSTR, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, null, BIGSTR));
      cb();
    });
  });

  function replacer(key, value) {
    if (typeof value !== 'object') {
      return `greetings:${key},${value}`;
    } else {
      return value;
    }
  }

  it('supports replacer functiopn', (cb) => {
    JsonYieldify.stringify(complexObject, replacer, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, replacer));
      cb();
    });
  });

  const PROPS = ['greetings', 'other'];

  it('supports replacer array', (cb) => {
    JsonYieldify.stringify(complexObject, PROPS, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(JSON.stringify(complexObject, PROPS));
      cb();
    });
  });

  it('handles buffer objects', (cb) => {
    const buffer = new Buffer(4096);
    buffer.fill(gibberish());
    test(buffer, cb);
  });

});

describe('asynchrony', () => {

  let tag = 0;
  let inProgress = false;

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
    for (let i = 0; i < 25000; ++i) {
      array[i] = new TestValue();
    }
    test(array, 10, cb);
  });

  it('handles enormous objects', (cb) => {
    const object = {};
    for (let i = 0; i < 25000; ++i) {
      object[`key:${i}:${gibberish()}`] = new TestValue();
    }
    test(object, 10, cb);
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

describe('edge cases', () => {

  it('handles circular objects', (cb) => {
    const obj = {};
    obj.value = obj;
    obj.array = [1, obj, 3];
    obj.object = { a: 1, b: obj, c: 3 };
    JsonYieldify.stringify(obj, (err, json) => {
      expect(err).to.not.exist;
      expect(json).to.equal(
        '{"value":"[Circular]","array":[1,"[Circular]",3]'
        + ',"object":{"a":1,"b":"[Circular]","c":3}}'
      );
      cb();
    });
  });

});
