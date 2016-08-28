# node-json-yieldify

An async `JSON.stringify` that yields periodically to the event loop.

```js
const JsonYieldify = require('json-yieldify');

JsonYieldify.stringify({greetings: 'Hello!'}, (err, json) => {
  if (err) return cb(err);
  // json = {"greetings":"Hello!"}
});
```

## Installation

```
$ npm install json-yieldify
```

## Features

- `JSON.stringify` that doesn't block the event loop
- Supports the `replacer` argument
- Supports the `space` argument (pretty-print)
- Handles arbitrarily complex arrays and object graphs

## Planned

- Readable stream signature
- Writeable stream signature (like JSONStream, but the values can be aribtrarily large)

## API

A single function is exported.

```
JsonYieldify.stringify(value[, replacer[, space]], cb)
```

The first three arguments are identical to the native `JSON.stringify`. The final argument is a Node-style callback (e.g. `(err, json) =>`).

See [here](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) for an explanation of the `JSON.stringify` arguments.

**Mutating the `value` while the function is running results in undefined behavior.**

## Alternatives

There are some other options in this space that may better meet your requirements.

- If you are streaming a large array of small JavaScript values (e.g. rows from a Postgres table), you should use [JSONStream](https://github.com/dominictarr/JSONStream).
