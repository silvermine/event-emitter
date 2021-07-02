'use strict';

var find = require('./lib/find'),
    reject = require('./lib/reject'),
    isArrayOfStrings = require('./lib/is-array-of-strings'),
    EventEmitterMixin;

// See the full JSDoc documentation for this object and its public methods in
// ./types/index.d.ts
EventEmitterMixin = {

   /**
    * Create the instance variable that stores registered listeners if it does not
    * already exist.
    * @private
    */
   _ensureListenersHashExists: function() {
      if (!this._eventListeners) {
         this._eventListeners = {};
      }
   },

   on: function(eventNames, listener, context) {
      var eventNamesList;

      if (typeof eventNames !== 'string' && !isArrayOfStrings(eventNames)) {
         throw new Error('the eventNames parameter must be a string or an array of strings, but was: ' + eventNames);
      }
      if (typeof listener !== 'function') {
         throw new Error('the listener parameter must be a function, but was: ' + (typeof listener));
      }
      eventNamesList = Array.isArray(eventNames) ? eventNames : [ eventNames ];

      // Remove the event listeners if they already exist. Listeners bound with this `on`
      // function should always override listeners bound with `once`.
      eventNamesList.forEach(function(eventName) {
         this._removeEventListener(eventName, listener, context);
      }.bind(this));

      // Add the event listeners
      eventNamesList.forEach(function(eventName) {
         this._addEventListener(eventName, listener, context);
      }.bind(this));

      return this;
   },

   /**
    * Register a listener function for a single event name.
    *
    * @param eventName {string} the name of the event your listener will be invoked on.
    * @param listener {function} the listener function that is called (sometimes
    * indirectly) when the `eventName` event is emitted. See the `callback` param
    * documentation for an explanation about when `listener` is called directly and when
    * it is called indirectly.
    * @param [context] {object} the object that will be the `this` context for the
    * `listener` function when it is executed
    * @param [callback=`listener`] {function} the function that will be called directly
    * when the `eventName` event is emitted. This allows us to call a different listener
    * function internally (such as the wrapper function that
    * {@link EventEmitterMixin#once} uses to remove itself after executing once) as a
    * wrapper around `listener`.
    * @instance
    * @private
    */
   _addEventListener: function(eventName, listener, context, callback) {
      var existingListener;

      this._ensureListenersHashExists();
      this._eventListeners[eventName] = this._eventListeners[eventName] || [];

      existingListener = this._findEventListener(eventName, listener, context);

      if (!existingListener) {
         // Only add the new listener if one does not already exist
         this._eventListeners[eventName].push({
            callback: (typeof callback === 'function') ? callback : listener,
            listener: listener,
            context: context,
         });
      }
   },

   /**
    * Finds an event listener.
    *
    * @param eventName {string} the name of the event
    * @param listener {function} the listener's function
    * @param [context] {object} the context originally given to the listener when it was
    * registered
    * @instance
    * @private
    * @returns {object} the listener object
    */
   _findEventListener: function(eventName, listener, context) {
      return find(this._eventListeners[eventName], function(eventListener) {
         return eventListener.listener === listener && eventListener.context === context;
      });
   },

   once: function(eventName, listener, context) {
      var self = this,
          oneOffEventListener;

      if (typeof eventName !== 'string') {
         throw new Error('the eventName parameter must be a string, but was: ' + (typeof eventName));
      }
      if (typeof listener !== 'function') {
         throw new Error('the listener parameter must be a function, but was: ' + (typeof listener));
      }

      oneOffEventListener = function() {
         var args = Array.prototype.slice.call(arguments),
             thisEventListener = self._findEventListener(eventName, listener, context);

         // Because listener function invocations are asynchronous, it's possible
         // that an event is emitted multiple times and its listener functions
         // queued up for invocation before any of its listener functions are
         // actually invoked. This means that listeners registered with `once`
         // could be invoked multiple times if the corresponding event is emitted
         // multiple times in the same turn of the browser's event loop. To prevent
         // that, here we check to see if the event listener still exists in the list
         // of registered events before invoking the listener function.
         if (thisEventListener) {
            listener.apply(this, args);
            self._removeEventListener(eventName, listener, context);
         }
      };
      this._addEventListener(eventName, listener, context, oneOffEventListener);
      return this;
   },

   off: function(eventNames, listener, context) {
      var eventNamesList;

      if (!eventNames) {
         this._eventListeners = {};
         return this;
      }

      eventNamesList = Array.isArray(eventNames) ? eventNames : [ eventNames ];
      eventNamesList.forEach(function(eventName) {
         this._removeEventListener(eventName, listener, context);
      }.bind(this));

      return this;
   },

   /**
    * Removes an event listener for a single event name.
    *
    * If only the `eventName` parameter is provided, then all listeners bound to
    * `eventName` will be removed.
    *
    * If the `eventName` and `listener` parameters only are provided, then all listeners
    * bound to `eventName` that use the given `listener` function will be removed.
    *
    * If all three `eventName`, `listener`, and `context` parameters are provided only
    * the listener registered with that specific event name, `listener` function and
    * context will be removed.
    *
    * @param eventName {string} the name of the event
    * @param [listener] {function} the listener that will be removed. If this parameter
    * is not provided, then **all** event listeners listening to `eventName` will be
    * removed.
    * @param [context] {object} the object that was provided as the `this` context for
    * the `listener` function when the event listener you are removing was registered
    * @instance
    * @private
    */
   _removeEventListener: function(eventName, listener, context) {
      this._ensureListenersHashExists();

      if (!listener) {
         this._eventListeners[eventName] = [];
         return;
      }

      this._eventListeners[eventName] = reject(this._eventListeners[eventName], function(eventListener) {
         return eventListener.listener === listener &&
            ((typeof context === 'undefined') ? true : (eventListener.context === context));
      });
   },

   emit: function(eventNames) {
      var args = Array.prototype.slice.apply(arguments),
          eventArgs = args.slice(1),
          eventNamesList;

      if (typeof eventNames !== 'string' && !isArrayOfStrings(eventNames)) {
         throw new Error('the eventNames parameter must be a string or an array of strings, but was: ' + eventNames);
      }

      eventNamesList = Array.isArray(eventNames) ? eventNames : [ eventNames ];

      eventNamesList.forEach(function(eventName) {
         this._emitEvent(eventName, eventArgs);
      }.bind(this));

      return this;
   },

   /**
    * Emits a single event.
    *
    * @param eventName {string} the name of the event to emit
    * @param eventArgs {array} the arguments / parameters passed to any listeners
    * registered to listen for `eventName` events
    * @instance
    * @private
    */
   _emitEvent: function(eventName, eventArgs) {
      this._ensureListenersHashExists();

      if (!this._eventListeners[eventName]) {
         return;
      }

      this._eventListeners[eventName].forEach(function(listener) {
         // A Promise's `.then` handlers are placed in the microtask queue, which are
         // executed at the end of the current run of the event loop. This effectively
         // makes the initial execution of these event listeners an asynchronous
         // operation.
         Promise.resolve()
            .then(function() {
               listener.callback.apply(listener.context, eventArgs);
            });
      });
   },

};

// Export the EventEmitterMixin as an ES-Module-compatible named export.
//
// TypeScript and ES-Module users will import the EventEmitterMixin object using the
// `import { EventEmitterMixin } from '@silvermine/event-emitter'` syntax and CommonJS
// users can use the object destructuring syntax: `const { EventEmitterMixin } =
// require('@silvermine/event-emitter')`
//
// Why not just use `module.exports = EventEmitterMixin` here as we did in v1.x? To add
// proper TypeScript types for `module.exports = SOMETHING`, you have to use the `export =
// SOMETHING` statement in your .d.ts file. TypeScript provides the `export =` statement
// for exactly this use case. However, using it means you cannot export any other object,
// type, or interface in that file. This means that we'd only be able to export the
// `EventEmitterMixin` object itself, and not the `IEventEmitter` interface. That would be
// very inconvenient for TypeScript users.
//
// Instead, we export the `EventEmitterMixin` as a named export. This allows us to export
// both the `IEventEmitter` interface and the `EventEmitterMixin` object in
// `./types/index.d.ts`.
module.exports.EventEmitterMixin = EventEmitterMixin;
