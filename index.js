'use strict';

const MAX_SEQUENTIAL_OPS = 250;

const NEXT = 0x0;
const VALUE = 0x1;
const OBJECT = 0x2;
const ARRAY = 0x3;

const ObjectTag = '[object Object]';
const ArrayTag = '[object Array]';

const toString = Object.prototype.toString;

function stringifyimpl(key, holder, replacerFunction, propertyList, gap, cb) {
  let state = VALUE;
  let index = 0;
  let keys = [];
  let length = 0;
  let nonempty = false;
  let indent = 0;

  const stackarray = [];
  const stackset = new Set();

  const frames = [];
  const indents = [''];
  const pretty = gap.length > 0;

  let json = '';
  let ops = 0;

  function save() {
    frames.push([key, holder, state, index, keys, length, nonempty, indent]);
  }

  function restore() {
    const frame = frames.pop();
    key = frame[0];
    holder = frame[1];
    state = frame[2];
    index = frame[3];
    keys = frame[4];
    length = frame[5];
    nonempty = frame[6];
    indent = frame[7];
  }

  function resume() {
    for (; ;) {
      switch (state) {
        case NEXT: {
          if (!frames.length) {
            cb(null, json);
            return;
          }
          restore();
          break;
        }
        case VALUE: {
          let value = holder[key];
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
          }
          if (replacerFunction !== undefined) {
            value = replacerFunction.call(holder, key, value);
          }
          if (value === undefined) {
            json = undefined;
            state = NEXT;
            break;
          }
          if (value === null) {
            json += 'null';
            state = NEXT;
            break;
          }
          const tag = toString.call(value);
          const isObject = tag === ObjectTag;
          const isArray = tag === ArrayTag;
          if (isObject || isArray) {
            stackarray.push(value);
            stackset.add(value);
            holder = value;
            index = 0;
            nonempty = false;
            indent += 1;
            if (isObject) {
              json += '{';
              state = OBJECT;
              keys = propertyList || Object.keys(value);
              length = keys.length;
            } else if (isArray) {
              json += '[';
              state = ARRAY;
              length = value.length;
            }
          } else {
            json += JSON.stringify(value);
            state = NEXT;
          }
          break;
        }
        case OBJECT: {
          if (index >= length) {
            state = NEXT;
            stackset.delete(stackarray.pop());
            indent = indent - 1;
            if (pretty && nonempty) {
              json += '\n' + indents[indent];
            }
            json += '}';
            break;
          }
          let value = holder[key = keys[index++]];
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
          }
          if (replacerFunction !== undefined) {
            value = replacerFunction.call(holder, key, value);
          }
          if (value === undefined) {
            break;
          }
          if (nonempty) {
            json += ',';
          } else {
            nonempty = true;
          }
          if (pretty) {
            json += '\n' + (
              indent > indents.length - 1
                ? (indents[indent] = indents[indent - 1] + gap)
                : indents[indent]
            );
          }
          json += JSON.stringify(key) + (pretty ? ': ' : ':');
          if (value === null) {
            json += 'null';
            break;
          }
          const tag = toString.call(value);
          const isObject = tag === ObjectTag;
          const isArray = tag === ArrayTag;
          if (isObject || isArray) {
            if (stackset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              stackarray.push(value);
              stackset.add(value);
              holder = value;
              index = 0;
              nonempty = false;
              indent += 1;
              if (isObject) {
                json += '{';
                state = OBJECT;
                holder = value;
                keys = propertyList || Object.keys(value);
                length = keys.length;
              } else if (isArray) {
                json += '[';
                state = ARRAY;
                holder = value;
                length = value.length;
              }
            }
          } else {
            json += JSON.stringify(value);
          }
          break;
        }
        case ARRAY: {
          if (index >= length) {
            state = NEXT;
            stackset.delete(stackarray.pop());
            indent = indent - 1;
            if (pretty && nonempty) {
              json += '\n' + indents[indent];
            }
            json += ']';
            break;
          }
          let value = holder[key = index++];
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
          }
          if (replacerFunction !== undefined) {
            value = replacerFunction.call(holder, key, value);
          }
          if (nonempty) {
            json += ',';
          } else {
            nonempty = true;
          }
          if (pretty) {
            json += '\n' + (
              indent > indents.length - 1
                ? (indents[indent] = indents[indent - 1] + gap)
                : indents[indent]
            );
          }
          if (value === undefined) {
            json += 'null';
            break;
          }
          if (value === null) {
            json += 'null';
            break;
          }
          const tag = toString.call(value);
          const isObject = tag === ObjectTag;
          const isArray = tag === ArrayTag;
          if (isObject || isArray) {
            if (stackset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              stackarray.push(value);
              stackset.add(value);
              holder = value;
              index = 0;
              nonempty = false;
              indent += 1;
              if (isObject) {
                json += '{';
                state = OBJECT;
                holder = value;
                keys = propertyList || Object.keys(value);
                length = keys.length;
              } else if (isArray) {
                json += '[';
                state = ARRAY;
                holder = value;
                length = value.length;
              }
            }
          } else {
            json += JSON.stringify(value);
          }
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

/**
 * Asynchronously converts a JavaScript value to a JSON string, optionally
 * replacing values if a replacer function is specified, or optionally including
 * only the specified properties if a replacer array is specified.
 *
 * @param {Any} value The value to convert to a JSON string.
 * @param {(Function|String[])=} replacer A function that alters the behavior of
 * the stringification process, or an array of String and Number objects that
 * serve as a whitelist for selecting the properties of the value object to be
 * included in the JSON string. If this value is null or not provided, all
 * properties of the object are included in the resulting JSON string.
 * @param {(Number|String)=} space A String or Number object that's used to
 * insert white space into the output JSON string for readability purposes. If
 * this is a Number, it indicates the number of space characters to use as white
 * space; this number is capped at 10 if it's larger than that. Values less than
 * 1 indicate that no space should be used. If this is a String, the string (or
 * the first 10 characters of the string, if it's longer than that) is used as
 * white space. If this parameter is not provided (or is null), no white space
 * is used.
 * @param {Function} cb Node-style callback.
 */
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

  let propertyList;
  let replacerFunction;
  if (typeof replacer === 'function') {
    replacerFunction = replacer;
  } else if (replacer instanceof Array) {
    propertyList = [];
    const set = new Set();
    for (let i = 0, iLen = replacer.length; i < iLen; ++i) {
      const v = replacer[i];
      let item;
      if (typeof v === 'string') {
        item = v;
      } else if (typeof v === 'number') {
        item = String(v);
      } else if (v instanceof String || v instanceof Number) {
        item = String(v);
      } else {
        continue;
      }
      if (!set.has(item)) {
        set.add(item);
        propertyList.push(item);
      }
    }
  }

  if (typeof space === 'object') {
    if (space instanceof Number) {
      space = Number(space);
    } else if (space instanceof String) {
      space = String(space);
    }
  }

  let gap;
  if (typeof space === 'number') {
    space = space > 10 ? 10 : (space << 0);
    gap = space > 0 ? ' '.repeat(space) : '';
  } else if (typeof space === 'string') {
    gap = space.length <= 10 ? space : space.slice(0, 10);
  } else {
    gap = '';
  }

  stringifyimpl('', { '': value }, replacerFunction, propertyList, gap, cb);
}

exports.stringify = stringify;
