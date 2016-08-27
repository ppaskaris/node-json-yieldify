'use strict';

var MAX_SEQUENTIAL_OPS = 250;

var NEXT = 0x0;
var VALUE = 0x1;
var OBJECT = 0x2;
var ARRAY = 0x3;

function stringifyimpl(key, holder, replacerFunction, propertyList, gap, cb) {
  var indent = 0;
  var index = 0;
  var keys = [];
  var length = 0;
  var nonempty = false;
  var state = VALUE;

  var stack = new Array(64);
  var stackptr = 0;

  var circulararray = [];
  var circularset = new Set();

  var pretty = gap.length > 0;

  var indents;
  var indentsptr = 0;

  if (pretty) {
    indents = new Array(16);
    indents[0] = '';
  }

  var objectdelim = pretty ? ': ' : ':';

  var json = '';
  var ops = 0;

  function save() {
    stack[stackptr++] = holder;
    stack[stackptr++] = indent;
    stack[stackptr++] = index;
    stack[stackptr++] = key;
    stack[stackptr++] = keys;
    stack[stackptr++] = length;
    stack[stackptr++] = nonempty;
    stack[stackptr++] = state;
  }

  function restore() {
    state = stack[--stackptr];
    nonempty = stack[--stackptr];
    length = stack[--stackptr];
    keys = stack[--stackptr];
    key = stack[--stackptr];
    index = stack[--stackptr];
    indent = stack[--stackptr];
    holder = stack[--stackptr];
  }

  function checkindent() {
    if (indent > indentsptr) {
      indentsptr += 1;
      indents[indentsptr] = indents[indentsptr - 1] + gap;
    }
  }

  function resume() {
    var value;
    var isObject;
    var isArray;
    for (; ;) {
      switch (state) {
        case NEXT: {
          if (stackptr <= 0) {
            cb(null, json);
            return;
          }
          restore();
          break;
        }
        case VALUE:
          state = NEXT;
          value = holder[key];
          if (value != null && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
          }
          if (replacerFunction !== undefined) {
            value = replacerFunction.call(holder, key, value);
          }
          if (value === undefined) {
            json = undefined;
            break;
          }
          if (value === null) {
            json += 'null';
            break;
          }
          isArray = value.constructor === Array;
          if (isArray) {
            save();
            circulararray.push(value);
            circularset.add(value);
            holder = value;
            indent += 1;
            index = 0;
            length = value.length;
            nonempty = false;
            state = ARRAY;
            json += '[';
            if (pretty) {
              checkindent();
            }
            break;
          }
          isObject = typeof value === 'object';
          if (isObject) {
            save();
            circulararray.push(value);
            circularset.add(value);
            holder = value;
            indent += 1;
            index = 0;
            keys = propertyList || Object.keys(value);
            length = keys.length;
            nonempty = false;
            state = OBJECT;
            json += '{';
            if (pretty) {
              checkindent();
            }
            break;
          }
          json += JSON.stringify(value);
          break;
        case OBJECT:
          if (index >= length) {
            circularset.delete(circulararray.pop());
            indent = indent - 1;
            if (pretty && nonempty) {
              json += '\n' + indents[indent];
            }
            json += '}';
            state = NEXT;
            break;
          }
          value = holder[key = keys[index++]];
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
            json += '\n' + indents[indent];
          }
          json += JSON.stringify(key) + objectdelim;
          if (value === null) {
            json += 'null';
            break;
          }
          isArray = value.constructor === Array;
          if (isArray) {
            if (circularset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              circulararray.push(value);
              circularset.add(value);
              holder = value;
              indent += 1;
              index = 0;
              length = value.length;
              nonempty = false;
              state = ARRAY;
              json += '[';
              if (pretty) {
                checkindent();
              }
            }
            break;
          }
          isObject = typeof value === 'object';
          if (isObject) {
            if (circularset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              circulararray.push(value);
              circularset.add(value);
              holder = value;
              indent += 1;
              index = 0;
              keys = propertyList || Object.keys(value);
              length = keys.length;
              nonempty = false;
              state = OBJECT;
              json += '{';
              if (pretty) {
                checkindent();
              }
            }
            break;
          }
          json += JSON.stringify(value);
          break;
        case ARRAY:
          if (index >= length) {
            circularset.delete(circulararray.pop());
            indent = indent - 1;
            if (pretty && nonempty) {
              json += '\n' + indents[indent];
            }
            json += ']';
            state = NEXT;
            break;
          }
          value = holder[key = index++];
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
            json += '\n' + indents[indent];
          }
          if (value === undefined) {
            json += 'null';
            break;
          }
          if (value === null) {
            json += 'null';
            break;
          }
          isArray = value.constructor === Array;
          if (isArray) {
            if (circularset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              circulararray.push(value);
              circularset.add(value);
              holder = value;
              indent += 1;
              index = 0;
              length = value.length;
              nonempty = false;
              state = ARRAY;
              json += '[';
              if (pretty) {
                checkindent();
              }
            }
            break;
          }
          isObject = typeof value === 'object';
          if (isObject) {
            if (circularset.has(value)) {
              json += '"[Circular]"';
            } else {
              save();
              circulararray.push(value);
              circularset.add(value);
              holder = value;
              indent += 1;
              index = 0;
              keys = propertyList || Object.keys(value);
              length = keys.length;
              nonempty = false;
              state = OBJECT;
              json += '{';
              if (pretty) {
                checkindent();
              }
            }
            break;
          }
          json += JSON.stringify(value);
          break;
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

  var propertyList;
  var replacerFunction;
  if (typeof replacer === 'function') {
    replacerFunction = replacer;
  } else if (replacer instanceof Array) {
    propertyList = [];
    var set = new Set();
    for (var i = 0, iLen = replacer.length; i < iLen; ++i) {
      var v = replacer[i];
      var item;
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

  var gap;
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
