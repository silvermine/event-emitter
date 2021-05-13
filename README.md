# Silvermine Event Emitter

[![Build Status](https://travis-ci.org/silvermine/event-emitter.svg?branch=master)](https://travis-ci.org/silvermine/event-emitter)
[![Coverage Status](https://coveralls.io/repos/github/silvermine/event-emitter/badge.svg?branch=master)](https://coveralls.io/github/silvermine/event-emitter?branch=master)
[![Dependency Status](https://david-dm.org/silvermine/event-emitter.svg)](https://david-dm.org/silvermine/event-emitter)
[![Dev Dependency Status](https://david-dm.org/silvermine/event-emitter/dev-status.svg)](https://david-dm.org/silvermine/event-emitter#info=devDependencies&view=table)


## What is it?

A small library that provides an event emitter mixin that can be added to your own JS
classes / objects to allow them to implement a pubsub/listener/observer pattern by means
of events.

There are a number of other libraries out there to do this, but many of them are either
not well-tested or have some other deficiency. We needed a solid, quality event emitter
mixin that we could use in a variety of projects.

The event emitter mixin is a CommonJS module, and will work both in node.js and in the
browser. For server-side usage, simply use the built-in `require` function to `require
('@silvermine/event-emitter')` and use the mixin. For browser environments, use a CommonJS
module loader like [Browserify](http://browserify.org/) or
[Webpack](https://webpack.github.io/).

`@silvermine/event-emitter` uses native [Promises][] to make event listener executions
asynchronous. Native Promises are available in node.js versions `0.12.18` and up, and in
[most browsers](http://caniuse.com/#feat=promises) except Internet Explorer. If you need
to support an environment that does not have native Promise support, you can easily add a
[Promise polyfill][].

`@silvermine/event-emitter` also uses these built-in `Array` methods that are only
available in Internet Explorer 9 and up:

   * [forEach][]
   * [filter][]
   * [isArray][]

## How do I use it?

### Creating an event emitter

The object returned by `require('@silvermine/event-emitter')` is designed to be used as a
mixin for javascript "classes". Here are a few different ways in which the mixin can be
used:

```js
var EventEmitterMixin = require('@silvermine/event-emitter'),
    MyClass, myInstance;

MyClass = function() {};

// Copy functions from EventEmitterMixin to MyClass.prototype
Object.assign(MyClass.prototype, EventEmitterMixin);
// Or use underscore or lodash
_.extend(MyClass.prototype, EventEmitterMixin);

myInstance = new MyClass();
myInstance.emit('hello');
```

Alternatively, if you prefer to use objects directly, without classes:

```js
var EventEmitterMixin = require('@silvermine/event-emitter'),
    myInstance;

myInstance = Object.create(EventEmitterMixin, {
   doSomething: function() {}
});

myInstance.emit('hello');
```

If you are using ES6, see [this guide on using mixins with ES6 classes][es6-mixins]. Here
is an example of a mixin function that can be used to add event emitter methods to an ES6
class:

```js

let EventEmitterMixin = require('@silvermine/event-emitter');

let MixinEventEmitter = (Base) => {
   Object.assign(Base.prototype, EventEmitterMixin);
   return Base;
};

class MyBaseClass {}

class MyClass extends MixinEventEmitter(MyBaseClass) {
   doSomething() {}
}

let myInstance = new MyClass();
myInstance.emit('started');

```

### Basic Usage

#### Adding and removing event listeners

Once you have an object that has the event emitter functions mixed in, you can begin
adding event listeners and emitting events. Use the `on` function to add an event
listener, then use the `emit` function to emit an event:

```js
myInstance.on('started', function() {
   console.log('myInstance started');
});

// Prints "myInstance started" to the console
myInstance.emit('started');
```

If you want an event listener to execute only once for a given event, use the `once`
function when adding the listener:

```js
myInstance.once('started', function() {
   console.log('myInstance started');
});

// Prints "myInstance started" to the console
myInstance.emit('started');
// Does nothing
myInstance.emit('started');
```

If you no longer want to listen to an event, use the `off` function to remove an event
listener:

```js
myInstance.on('started', function() {
   console.log('myInstance started');
});

// Prints "myInstance started" to the console
myInstance.emit('started');

// Remove the event listener for the 'started' event
myInstance.off('started');

// Does nothing
myInstance.emit('started');
```

You can also remove all event listeners from an object by calling `off` with no arguments:

```js
myInstance.on('started', function() {
   console.log('myInstance started');
});

myInstance.on('ended', function() {
   console.log('myInstance ended');
});

// Remove all event listeners
myInstance.off();

// Does nothing
myInstance.emit('started');
myInstance.emit('ended');
```

#### Chaining

All functions in event emitter are chainable; they return `this` so that subsequent
function calls can chain off of each other:

```js
function listener1() {}
function listener2() {}

myInstance.on('started', listener1)
   .on('stopped', listener2)
   .off('paused')
   .emit('started')
```

#### Passing arguments with emitted events

You may want to pass arguments to listener functions when emitting an event. Any
arguments given to `emit` after the event name(s) argument will be passed to any
listener functions:

```js
function onStarted(instance, initialValue) {
   console.log(instance, 'was started with an initialValue of', initialValue);
}

myInstance.on('started', onStarted);

myInstance.emit('started', myInstance, 42);

```

### Advanced usage

#### Binding a listener function to multiple events

You may want to bind one event listener to several event names. You can either bind them
individually or within a single call to `on` by passing a space-delimited list of event
names:

```js
function onChange {}

myInstance.on('started stopped paused', onChange);

// or:
myInstance.on('started', onChange)
   .on('stopped', onChange)
   .on('paused', onChange);
```

#### Emitting multiple events

You can emit multiple events with a single call to `emit` by passing a space-delimited
list of event names:

```js
myInstance.emit('initialized started played');
```

#### Removing a single listener when multiple listeners are bound to the same event name

If you add multiple event listeners to the same object for the same event name, you may
remove a single event listener without affecting the others by passing in the listener
function to the `off` function:

```js
function listener1 {}
function listener2 {}
function listener3 {}

myInstance.on('started', listener1);
myInstance.on('started', listener2);
myInstance.on('started', listener3);

myInstance.off('started', listener2);

// listener1 and listener3 are executed, but listener2 is not
myInstance.emit('started');
```

#### Using a custom `this` context for a listener function

Sometimes you need a function to execute with a certain `this` context. It may be tempting
to bind the context directly to the listener function:

```js
myInstance.on('started', app.onStarted.bind(app));
```

However, using `.bind(app)` makes it impossible to remove that specific listener when
there are multiple listeners bound to the same event name:

```js
function listener1 {}
function listener2 {}

myInstance.on('started', listener1.bind(this));
myInstance.on('started', listener2.bind(this));

// Does nothing. listener2 remains bound.
myInstance.off('started', listener2);
```

##### Why does this happen?

Binding a `this` context to a function creates a new instance of `Function`, so when we
search for the listener function to remove it, the identity check fails:

```js
function listener() {}

listener.bind(this) === listener.bind(this); // false
```

##### So how do I bind a `this` context to a listener?

To use a custom `this` context when binding a listener function, pass the context in the
call to `on` instead:

```js
function listener1 {}
function listener2 {}

myInstance.on('started', listener1, this);
myInstance.on('started', listener2, this);
```

To remove a specific listener and context combination, pass the listener and context to
`off`:

```js
// Removes listener2, but listener1 remains
myInstance.off('started', listener2, this);

// or:
myInstance.off('started'); // removes all listeners bound to 'started'
```

## How do I contribute?

We genuinely appreciate external contributions. See [our extensive
documentation][contributing] on how to contribute.


## License

This software is released under the MIT license. See [the license file](LICENSE) for more
details.

[Promises]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
[Promise polyfill]: https://github.com/taylorhakes/promise-polyfill
[forEach]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
[filter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
[isArray]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
[es6-mixins]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#Mix-ins
[contributing]: https://github.com/silvermine/silvermine-info#contributing
