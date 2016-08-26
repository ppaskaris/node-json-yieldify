'use strict';

const NEXT = 0x0;
const VALUE = 0x1;
const ARRAY = 0x2;
const OBJECT = 0x3;

const NO_KEYS = [];
const MAX_SEQUENTIAL_OPS = 2500;

function Frame(state, index, keys, length, comma) {
  this.state = state;
  this.index = index;
  this.keys = keys;
  this.length = length;
  this.comma = comma;
}

function stringify(value, replacer, indent, cb) {
  if (typeof replacer === 'function') {
    cb = replacer;
    indent = null;
    replacer = null;
  } else if (typeof indent === 'function') {
    cb = indent;
    indent = null;
  }

  let state = VALUE;
  let index = 0;
  let keys = NO_KEYS;
  let length = 0;
  let comma = false;

  const frames = [];
  const values = [];

  let json = '';
  let ops = 0;

  function done() {
    cb(null, json.length > 0 ? json : undefined);
  }

  function resume() {
    for (; ;) {
      switch (state) {
        case NEXT: {
          if (!frames.length) {
            done();
            return;
          }

          const frame = frames.pop();
          state = frame.state;
          index = frame.index;
          keys = frame.keys;
          length = frame.length;
          comma = frame.comma;

          value = values.pop();

          break;
        }
        case VALUE: {
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON();
          }

          if (value === undefined) {
            state = NEXT;
            break;
          }

          if (value === null || typeof value !== 'object') {
            json += JSON.stringify(value);
            state = NEXT;
            break;
          }

          if (Array.isArray(value)) {
            json += '[';
            state = ARRAY;
            index = 0;
            length = value.length;
            comma = false;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(value);
          length = keys.length;
          comma = false;
          break;
        }
        case ARRAY: {
          if (index >= length) {
            json += ']';
            state = NEXT;
            break;
          }

          let item = value[index++];
          if (item != null && typeof item.toJSON === 'function') {
            item = item.toJSON();
          }

          if (comma) {
            json += ',';
          } else {
            comma = true;
          }

          if (item === undefined) {
            json += 'null';
            break;
          }

          if (item === null || typeof item !== 'object') {
            json += JSON.stringify(item);
            break;
          }

          frames.push(new Frame(state, index, keys, length, comma));
          values.push(value);

          if (Array.isArray(item)) {
            json += '[';
            state = ARRAY;
            index = 0;
            length = item.length;
            value = item;
            comma = false;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(item);
          length = keys.length;
          value = item;
          comma = false;
          break;
        }
        case OBJECT: {
          if (index >= length) {
            json += '}';
            state = NEXT;
            keys = NO_KEYS;
            break;
          }

          const key = keys[index++];

          let item = value[key];
          if (item != null && typeof item.toJSON === 'function') {
            item = item.toJSON();
          }

          if (item === undefined) {
            break;
          }

          if (comma) {
            json += ',';
          } else {
            comma = true;
          }

          json += JSON.stringify(key) + ':';

          if (item === null || typeof item !== 'object') {
            json += JSON.stringify(item);
            break;
          }

          frames.push(new Frame(state, index, keys, length, comma));
          values.push(value);

          if (Array.isArray(item)) {
            json += '[';
            state = ARRAY;
            index = 0;
            length = item.length;
            value = item;
            comma = false;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(item);
          length = keys.length;
          value = item;
          comma = false;
          break;
        }
      }

      if (++ops > MAX_SEQUENTIAL_OPS) {
        ops = 0;
        setImmediate(resume);
        return;
      }
    }
  }

  process.nextTick(resume);
}

exports.stringify = stringify;
