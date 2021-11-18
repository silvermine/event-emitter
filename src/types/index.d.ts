/**
 * @private
 */
// eslint-disable-next-line @typescript-eslint/no-type-alias
type RestParameters<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Can be used as a mixin when making a class that needs to be an EventEmitter.
 *
 * e.g. `Object.assign(MyClass.prototype, EventEmitterMixin);`
 *
 * Note: if it is necessary to override a listener function's `this` context, always use
 * the optional `context` parameter on the {@link IEventEmitter.on} method to do so if you
 * want to remove that specific listener or listener and context combination later. If you
 * are using {@link IEventEmitter.once} or never need to remove the event listener, using
 * `listener.bind(context)` instead of the context parameter is acceptable.
 *
 * It is common to override a listener function's `this` context using the `Function`
 * object's `bind` method. For example:
 *
 * ```
 * emitter.on('ready', this.onReady.bind(this));
 * ```
 *
 * However, doing so will make it impossible to remove that listener function without
 * calling `emitter.off('ready')`, which would remove **all** listeners for the `ready`
 * event.
 *
 * This happens because calling `.bind(context)` on a function produces a completely
 * new `Function` instance. When it's time to remove an event listener that was bound
 * to a context using the `bind` function, calling `bind` on the same function will
 * produce a different instance that does not pass an equality check with the
 * previously bound function. For example:
 *
 * ```
 * var fn = function() {},
 *     context = {};
 *
 * fn === fn; // true
 * fn.bind(context) === fn.bind(context); // false
 * ```
 *
 * And so:
 *
 * ```
 * emitter.on('ready', fn.bind(context));
 * emitter.off('ready', fn.bind(context));
 * ```
 *
 * does not remove the event listener that is listening to `'ready'` which results in a
 * memory leak. The correct way is to use the third argument to `on`, which lets you
 * specify the context for the `listener` function:
 *
 * ```
 * emitter.on('ready', fn, context);
 * ```
 *
 * Then, to remove that particular listener, call {@link IEventEmitter.off} and pass the
 * same event name, function, and context:
 *
 * ```
 * emitter.off('ready', fn, context);
 * ```
 *
 * **WARNING: JavaScript does not allow you to re-bind the `this` context of an arrow
 * function. If you pass an arrow function as a listener, the `context` parameter will
 * have no effect.** If you need to re-bind the context, use a `function` statement
 * instead.
 *
 * @mixin
 */
export interface IEventEmitter<EventListeners = Record<string, (...args: any) => any>> {

   /**
    * Register a listener function that will be called every time the specified event is
    * emitted.
    *
    * Calls to `on` will de-duplicate listeners so that the same listener and context
    * combination does not get invoked more than once for the same event. Also, calls to
    * `on` override calls to {@link IEventEmitter.once} in that if there is still an event
    * listener and context combination registered from a call to
    * {@link IEventEmitter.once} and the same listener and context combination is passed
    * to a call to `on`, that listener and context combination will **not** be removed
    * after the first event.
    *
    * If the `listener` function (or the listener function and its associated `context`)
    * was already registered using {@link IEventEmitter.on} or
    * {@link IEventEmitter.once}, registering it again with `on` will have the
    * following effect:
    *
    *    * `on`: if it was registered with `on`, nothing happens. There remains one
    *    listener registered for the `eventNames` event(s).
    *    * `once`: if it was registered with `once`, and the `eventName` event has not
    *    been emitted yet, then that listener becomes an `on` listener, is executed each
    *    time that the event is emitted, and is **not** removed after it has been called
    *    once.
    *
    * @param eventNames - one or more names of the event(s) your listener will be
    * invoked for, when emitted. Providing an array of names will bind the provided
    * listener to each of the events listed.
    * @param listener - the listener that will be called when this event is
    * emitted. **WARNING: JavaScript does not allow you to re-bind the `this` context of
    * an arrow function. If you pass an arrow function as a listener, the `context`
    * parameter will have no effect.**
    * @param [context] - the object that will be the `this` context for the `listener`
    * function when it is executed. See the documentation on {@link IEventEmitter} for
    * an explanation of when and how to use this parameter. See the WARNING on `listener`
    * parameter documentation.
    *
    * @instance
    * @returns `this` for chaining
    */
   on<K extends keyof EventListeners>(eventNames: K | K[], listener: EventListeners[K], context?: unknown): this;

   /**
    * Register a listener function that will be called only once. After the listener is
    * invoked for the first time, it will be discarded.
    *
    * If the `listener` function or the `listener` function and context is already
    * registered using either {@link IEventEmitter.on} or {@link IEventEmitter.once}, this
    * operation essentially has no effect.
    *
    * Unlike the {@link IEventEmitter.on} function, this function can only register a
    * listener for one `eventName` at a time. This saves us from a large amount of
    * complexity in the EventEmitter API. For example:
    *
    * ```
    * var listener = function() {};
    *
    * eventEmitter
    *    .once([ 'a', 'b', 'c' ], listener)
    *    .on('b', listener)
    *    .emit('b');
    * ```
    *
    * Should there be one event listener bound for each of 'a', 'b', and 'c'? Or would
    * `listener` only execute one time for 'a' *or* 'b' *or* 'c'? Further, if the 'b'
    * event is emitted, as shown above, would you expect `listener` to be executed once,
    * or twice? If 'c' is then emitted after 'b', should `listener` be executed again, or
    * was it removed as the result of emitting 'b'? Even a simple example raises many
    * questions with non-obvious answers. Allowing `once` to register only one event
    * listener at a time gives us a more straightforward API that is easy to understand
    * and reason about.
    *
    * If you would like to create a listener that will only execute once across multiple
    * event names, you can do so using the Underscore or Lodash library's `_.once`
    * function. For example:
    *
    * ```
    * var listener = _.once(function() {});
    *
    * eventEmitter
    *    .once('a', listener)
    *    .once('b', listener)
    *    .once('c', listener);
    * ```
    *
    * Then, when either the 'a', 'b', or 'c' events are emitted, the listener function
    * will be invoked once and will not be invoked again for any 'a', 'b', or 'c' events.
    * However, note that if the other two events are not emitted then `listener` remains
    * in memory. In the example above, if 'a' is emitted then the `listener` function
    * remains registered and in-memory for events 'b' and 'c' until both 'b' and 'c'
    * are emitted.
    *
    * @param eventName - the name of the event your listener will be invoked on.
    * @param listener - the listener that will be called the first time this event is
    * emitted. **WARNING: JavaScript does not allow you to re-bind
    * the `this` context of an arrow function. If you pass an arrow function as a
    * listener, the `context` parameter will have no effect.**
    * @param [context] the object that will be the `this` context for the `listener`
    * function when it is executed.
    * @instance
    * @returns `this` for chaining
    */
   once<K extends keyof EventListeners>(eventName: K, listener: EventListeners[K], context?: unknown): this;

   /**
    * Removes event listeners.
    *
    * If this function is called with no parameters, then all event listeners bound to
    * this object will be removed.
    *
    * If only the `eventNames` parameter is provided, then all listeners bound to each
    * name in `eventNames` will be removed.
    *
    * If the `eventNames` and `listener` parameters only are provided, then all listeners
    * for each name in `eventNames` that use the given `listener` function will be
    * removed.
    *
    * If all three `eventNames`, `listener`, and `context` parameters are provided, for
    * each event name in `eventNames`, only the listener registered with that specific
    * event name, `listener` function, and context will be removed.
    *
    * @param [eventNames] - the name(s) of one or more events. Providing am array of event
    * names will remove the listeners for each of the events listed. Omitting this
    * parameter will remove all event listeners from this object.
    * @param [listener] - the listener that will be removed. If this parameter
    * is not provided, then **all** event listeners listening to each `eventName` will be
    * removed.
    * @param [context] - the object that was provided as the `this` context for the
    * `listener` function when the event listener you are removing was registered. See the
    * documentation on {@link IEventEmitter} for an explanation of when and how to use
    * this parameter. If this parameter is not provided, then **all** event listeners
    * listening to each `eventName` using the given `listener` function will be removed.
    * @instance
    * @returns `this` for chaining
    */
   off<K extends keyof EventListeners>(eventNames?: K | K[], listener?: EventListeners[K], context?: unknown): this;

   /**
    * Emits an event to any listeners registered for it.
    *
    * @param eventNames - the names of one or more events to emit. Providing an array of
    * names will emit each of the events listed.
    * @param * {...*} all other arguments will be passed to the event listeners
    * @instance
    * @returns `this` for chaining
    */
   emit<K extends keyof EventListeners>(eventNames: K | K[], ...args: RestParameters<EventListeners[K]>): this;
}

declare const EventEmitterMixin: IEventEmitter;

// This corresponds to the `module.exports.EventEmitterMixin = EventEmitterMixin`
// statement in `index.js`
export { EventEmitterMixin };
