'use strict';

const NEXT = 0x0;
const VALUE = 0x1;
const ARRAY = 0x2;
const OBJECT = 0x3;

const NO_KEYS = [];
const MAX_SEQUENTIAL_OPS = 2500;

function Frame(state, index, keys, length, nonempty, depth) {
  this.state = state;
  this.index = index;
  this.keys = keys;
  this.length = length;
  this.nonempty = nonempty;
  this.depth = depth;
}

function stringify(value, replacer, space, cb) {
  switch (arguments.length) {
    case 3:
      cb = space;
      space = null;
      break;
    case 2:
      cb = replacer;
      space = null;
      replacer = null;
      break;
  }

  let state = VALUE;
  let index = 0;
  let keys = NO_KEYS;
  let length = 0;
  let nonempty = false;
  let depth = 0;

  const frames = [];
  const values = [];

  let json = '';
  let ops = 0;

  let hasReplacer = false;
  if (Array.isArray(replacer)) {
    hasReplacer = true;
    const keysToKeep = replacer;
    replacer = function arrayReplacer(key, value) {
      if (key === '' || keysToKeep.indexOf(key) >= 0) {
        return value;
      }
    };
  } else if (typeof replacer === 'function') {
    hasReplacer = true;
  }

  const indents = [''];
  let prettyPrint = false;
  if (typeof space === 'string') {
    prettyPrint = true;
    if (space.length > 10) {
      space = space.slice(0, 10);
    }
  } if (typeof space === 'number') {
    prettyPrint = true;
    space = ' '.repeat(space > 10 ? 10 : space);
  }

  function indent() {
    if (depth >= indents.length) {
      for (let i = indents.length - 1; i <= depth; ++i) {
        indents.push(indents[i] + space);
      }
    }
    return indents[depth];
  }

  function done() {
    cb(null, json.length > 0 ? json : undefined);
  }

  function save() {
    frames.push(new Frame(state, index, keys, length, nonempty, depth));
    values.push(value);
  }

  function restore() {
    const frame = frames.pop();
    state = frame.state;
    index = frame.index;
    keys = frame.keys;
    length = frame.length;
    nonempty = frame.nonempty;
    depth = frame.depth;
    value = values.pop();
  }

  function resume() {
    for (; ;) {
      switch (state) {
        case NEXT: {
          if (!frames.length) {
            done();
            return;
          }
          restore();
          break;
        }
        case VALUE: {
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON();
          }

          if (hasReplacer) {
            value = replacer('', value);
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
            nonempty = false;
            depth = depth + 1;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(value);
          length = keys.length;
          nonempty = false;
          depth = depth + 1;
          break;
        }
        case ARRAY: {
          if (index >= length) {
            state = NEXT;
            depth = depth - 1;
            if (prettyPrint && nonempty) {
              json += '\n' + indent();
            }
            json += ']';
            break;
          }

          let item = value[index];
          if (item != null && typeof item.toJSON === 'function') {
            item = item.toJSON();
          }

          if (hasReplacer) {
            item = replacer(index, item);
          }

          index += 1;

          if (nonempty) {
            json += ',';
          } else {
            nonempty = true;
          }

          if (prettyPrint) {
            json += '\n' + indent();
          }

          if (item === undefined) {
            json += 'null';
            break;
          }

          if (item === null || typeof item !== 'object') {
            json += JSON.stringify(item);
            break;
          }

          save();

          if (Array.isArray(item)) {
            json += '[';
            state = ARRAY;
            index = 0;
            length = item.length;
            value = item;
            nonempty = false;
            depth = depth + 1;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(item);
          length = keys.length;
          value = item;
          nonempty = false;
          depth = depth + 1;
          break;
        }
        case OBJECT: {
          if (index >= length) {
            state = NEXT;
            keys = NO_KEYS;
            depth = depth - 1;
            if (prettyPrint && nonempty) {
              json += '\n' + indent();
            }
            json += '}';
            break;
          }

          const key = keys[index];

          let item = value[key];
          if (item != null && typeof item.toJSON === 'function') {
            item = item.toJSON();
          }

          if (hasReplacer) {
            item = replacer(key, item);
          }

          index += 1;

          if (item === undefined) {
            break;
          }

          if (nonempty) {
            json += ',';
          } else {
            nonempty = true;
          }

          if (prettyPrint) {
            json += '\n' + indent();
          }

          json += JSON.stringify(key) + ':';

          if (prettyPrint) {
            json += ' ';
          }

          if (item === null || typeof item !== 'object') {
            json += JSON.stringify(item);
            break;
          }

          save();

          if (Array.isArray(item)) {
            json += '[';
            state = ARRAY;
            index = 0;
            length = item.length;
            value = item;
            nonempty = false;
            depth = depth + 1;
            break;
          }

          json += '{';
          state = OBJECT;
          index = 0;
          keys = Object.keys(item);
          length = keys.length;
          value = item;
          nonempty = false;
          depth = depth + 1;
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
