'use strict';

var BATCH_SIZE = 500;
var CIRCULAR_JSON = '"[Circular]"';

var STATE_INIT = 0x00;
var STATE_NEXT = 0x01;
var STATE_OBJECT = 0x02;
var STATE_ARRAY = 0x03;

var EMPTY_ARRAY = [];
var EMPTY_OBJECT = {};
var NOOP = function () {};

function Frame() {
  this.depth = 0;
  this.holder = EMPTY_OBJECT;
  this.indent = '';
  this.index = 0;
  this.key = '';
  this.keys = EMPTY_ARRAY;
  this.length = 0;
  this.nonempty = false;
  this.state = STATE_INIT;
}

Frame.prototype.reset = function () {
  Frame.call(this);
};

function StringifyContext() {
  this.framestack = [new Frame()];
  this.indentstack = [''];
  this.stackptr = 0;
  this.stackmax = 0;

  this.circularset = new WeakSet();

  this.propertyList = EMPTY_ARRAY;
  this.replacerFunction = NOOP;

  this.pretty = false;
  this.delimiter = ':';
  this.gap = '';

  this.ops = 0;
  this.json = '';
  this.done = NOOP;
}

StringifyContext.prototype.push = function () {
  if (this.stackptr >= this.stackmax) {
    this.framestack.push(new Frame());
    if (this.pretty) {
      this.indentstack.push(this.indent + this.gap);
    }
    this.stackptr += 1;
    this.stackmax += 1;
  } else {
    this.stackptr += 1;
  }
};

StringifyContext.prototype.pop = function () {
  if (this.stackptr >= 0) {
    this.frame.reset();
    this.stackptr -= 1;
  }
};

Object.defineProperty(StringifyContext.prototype, 'frame', {
  get: function frameGetter() {
    return this.framestack[this.stackptr];
  }
});

Object.defineProperty(StringifyContext.prototype, 'indent', {
  get: function frameGetter() {
    return this.indentstack[this.stackptr];
  }
});

StringifyContext.prototype.resumeInit = function () {
  var value = this.frame.holder[this.frame.key];
  if (value != null && typeof value.toJSON === 'function') {
    value = value.toJSON(this.frame.key);
  }

  if (this.replacerFunction !== NOOP) {
    value = this.replacerFunction
      .call(this.frame.holder, this.frame.key, value);
  }

  this.frame.state = STATE_NEXT;

  if (value === undefined) {
    this.json = undefined;
  } else if (value === null) {
    this.json = 'null';
  } else if (Array.isArray(value)) {
    this.push();
    this.frame.holder = value;
    this.frame.length = value.length;
    this.frame.state = STATE_ARRAY;
    this.circularset.add(value);
    this.json += '[';
  } else if (typeof value === 'object') {
    this.push();
    this.frame.holder = value;
    this.frame.keys = this.propertyList === EMPTY_ARRAY
      ? Object.keys(value)
      : this.propertyList;
    this.frame.length = this.frame.keys.length;
    this.frame.state = STATE_OBJECT;
    this.circularset.add(value);
    this.json += '{';
  } else {
    this.json += JSON.stringify(value);
  }
};

StringifyContext.prototype.resumeArray = function () {
  if (this.frame.index >= this.frame.length) {
    var nonempty = this.frame.nonempty;
    this.circularset.delete(this.frame.holder);
    this.pop();
    if (this.pretty && nonempty) {
      this.json += '\n' + this.indent;
    }
    this.json += ']';
    return;
  }

  var value = this.frame.holder[this.frame.index];
  if (value != null && typeof value.toJSON === 'function') {
    value = value.toJSON(this.frame.index);
  }

  if (this.replacerFunction !== NOOP) {
    value = this.replacerFunction
      .call(this.frame.holder, this.frame.index, value);
  }

  this.frame.index += 1;

  if (this.frame.nonempty) {
    this.json += ',';
  } else {
    this.frame.nonempty = true;
  }

  if (this.pretty) {
    this.json += '\n' + this.indent;
  }

  if (value == null) {
    this.json += 'null';
  } else if (Array.isArray(value)) {
    if (this.circularset.has(value)) {
      this.json += CIRCULAR_JSON;
    } else {
      this.push();
      this.frame.holder = value;
      this.frame.length = value.length;
      this.frame.state = STATE_ARRAY;
      this.circularset.add(value);
      this.json += '[';
    }
  } else if (typeof value === 'object') {
    if (this.circularset.has(value)) {
      this.json += CIRCULAR_JSON;
    } else {
      this.push();
      this.frame.holder = value;
      this.frame.keys = this.propertyList === EMPTY_ARRAY
        ? Object.keys(value)
        : this.propertyList;
      this.frame.length = this.frame.keys.length;
      this.frame.state = STATE_OBJECT;
      this.circularset.add(value);
      this.json += '{';
    }
  } else {
    this.json += JSON.stringify(value);
  }
};

StringifyContext.prototype.resumeObject = function () {
  if (this.frame.index >= this.frame.length) {
    var nonempty = this.frame.nonempty;
    this.circularset.delete(this.frame.holder);
    this.pop();
    if (this.pretty && nonempty) {
      this.json += '\n' + this.indent;
    }
    this.json += '}';
    return;
  }

  this.frame.key = this.frame.keys[this.frame.index];

  var value = this.frame.holder[this.frame.key];
  if (value != null && typeof value.toJSON === 'function') {
    value = value.toJSON(this.frame.key);
  }

  if (this.replacerFunction !== NOOP) {
    value = this.replacerFunction
      .call(this.frame.holder, this.frame.key, value);
  }

  this.frame.index += 1;

  if (value === undefined) {
    return;
  }

  if (this.frame.nonempty) {
    this.json += ',';
  } else {
    this.frame.nonempty = true;
  }

  if (this.pretty) {
    this.json += '\n' + this.indent;
  }

  this.json += JSON.stringify(this.frame.key) + this.delimiter;

  if (value === null) {
    this.json += 'null';
  } else if (Array.isArray(value)) {
    if (this.circularset.has(value)) {
      this.json += CIRCULAR_JSON;
    } else {
      this.push();
      this.frame.holder = value;
      this.frame.length = value.length;
      this.frame.state = STATE_ARRAY;
      this.circularset.add(value);
      this.json += '[';
    }
  } else if (typeof value === 'object') {
    if (this.circularset.has(value)) {
      this.json += CIRCULAR_JSON;
    } else {
      this.push();
      this.frame.holder = value;
      this.frame.keys = this.propertyList === EMPTY_ARRAY
        ? Object.keys(value)
        : this.propertyList;
      this.frame.length = this.frame.keys.length;
      this.frame.state = STATE_OBJECT;
      this.circularset.add(value);
      this.json += '{';
    }
  } else {
    this.json += JSON.stringify(value);
  }
};

function resume(ctx) {
  while (++ctx.ops <= BATCH_SIZE) {
    switch (ctx.frame.state) {
      case STATE_INIT:
        ctx.resumeInit();
        break;
      case STATE_NEXT:
        if (ctx.stackptr <= 0) {
          ctx.done(null, ctx.json);
          return;
        }
        ctx.pop();
        break;
      case STATE_ARRAY:
        ctx.resumeArray();
        break;
      case STATE_OBJECT:
        ctx.resumeObject();
        break;
    }
  }
  ctx.ops = 0;
  setImmediate(resume, ctx);
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


  var ctx = new StringifyContext();
  ctx.frame.key = '';
  ctx.frame.holder = { '': value };
  if (replacerFunction != null) {
    ctx.replacerFunction = replacerFunction;
  }
  if (propertyList != null) {
    ctx.propertyList = propertyList;
  }
  if (gap.length > 0) {
    ctx.pretty = true;
    ctx.delimiter = ': ';
    ctx.gap = gap;
  }
  ctx.done = cb;
  process.nextTick(resume, ctx);
}

exports.stringify = stringify;
