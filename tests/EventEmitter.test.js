'use strict';

var expect = require('expect.js'),
    EventEmitterMixin = require('../src/index'),
    Class = require('class.extend'),
    sinon = require('sinon'),
    _ = require('underscore'),
    Q = require('q'),
    EventEmitter = Class.extend(EventEmitterMixin);

/**
 * Helper for getting the number of times a given function has been
 * executed with a given `this` context. This is necessary because
 * EventEmitterMixin#emit does not guarantee that it will execute
 * handler functions in the same order in which they are registered.
 *
 * @param spyFn {function} the sinon spy function under test
 * @param context {object} the `this` context to count the number
 * of times that `spyFn` was invoked with
 * @returns {int} the number of times that `spyFn` was invoked with `context` as its
 * `this` context
 */
function getTimesFnCalledWithContext(spyFn, context) {
   var calls = spyFn.getCalls(),
       callCount = 0;

   _.each(calls, function(call) {
      if (call.calledOn(context)) {
         callCount += 1;
      }
   });

   return callCount;
}

/**
 * This function is a helper used to avoid having to nest a series of function calls
 * inside of `.then` callbacks.
 *
 * Because EventEmitter#emit executes handlers asynchronously, our tests need to be
 * asynchronous. Additionally, if one part of the test needs to fire **after** a
 * previous part of the test that emits an event, we cannot simply chain `.then` handlers
 * because calling `.then` immediately adds the function to the microtask queue which will
 * cause the `.then` handlers to execute out of sync with the event handlers. Consider
 * this example:
 *
 * ```
 * eventEmitter.on('event1 event2 event3', listener);
 *
 * eventEmitter.emit('event1');
 * sinon.assert.calledOnce(listener);
 *
 * eventEmitter.emit('event2');
 * sinon.assert.calledTwice(listener);
 *
 * eventEmitter.emit('event3');
 * sinon.assert.calledThrice(listener);
 * ```
 *
 * That test won't pass because `eventEmitter.emit` executes event handler functions
 * asynchronously, so at the time `sinon.assert.calledOnce(listener)` is called,
 * `listener` has not been executed yet. However, we cannot just:
 *
 * ```
 * eventEmitter.emit('event1');
 * return Q.delay(0).then(function then1() {
 *    sinon.assert.calledOnce(listener);
 *    eventEmitter.emit('event2');
 * })
 * .then(function then2() {
 *    sinon.assert.calledTwice(listener);
 *    eventEmitter.emit('event3');
 * })
 * .then(function then3() {
 *    sinon.assert.calledThrice(listener);
 * });
 * ```
 *
 * because the execution order there is:
 *    1. callbacks for 'event1'
 *    2. then1
 *    3. then2
 *    4. then3
 *    5. callbacks for 'event2'
 *    6. callbacks for 'event3'
 *
 * which fails at the `calledTwice` assertion inside of `then2`.
 *
 * The correct approach is to nest event handlers inside of each other, like this:
 * ```
 * return Q.delay(0).then(function() {
 *    sinon.assert.calledOnce(listener);
 *
 *    eventEmitter.emit('currentItemChanged');
 *    return Q.delay(0).then(function() {
 *       sinon.assert.calledTwice(listener);
 *
 *       eventEmitter.emit('itemPlaying');
 *       return Q.delay(0).then(function() {
 *          sinon.assert.calledThrice(listener);
 *       });
 *    });
 * });
 * ```
 *
 * This is a helper function that will nest an array of functions for you
 * to avoid the unwieldy / hard to read pyramid callback structure.
 *
 * @param fns {Array} functions to nest, in order from outermost to innermost.
 * @returns {Promise}
 */
function nestFunctions(fns) {
   if (fns.length === 1) {
      return Q.delay(0).then(fns[0]);
   }
   return Q.delay(0).then(function() {
      fns[0]();
      return nestFunctions(fns.slice(1));
   });
}

describe('EventEmitter', function() {

   describe('emit', function() {
      it('is chainable', function() {
         var eventEmitter = new EventEmitter();

         expect(eventEmitter.emit('event1')).to.be(eventEmitter);
      });

      it('throws an error if the eventNames parameter is not a string', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*must be a string.*/;

         expect(eventEmitter.emit.bind(eventEmitter)).to.throwError(errorRegex);
         expect(eventEmitter.emit.bind(eventEmitter, null)).to.throwError(errorRegex);
         expect(eventEmitter.emit.bind(eventEmitter, _.noop)).to.throwError(errorRegex);
      });

      it('executes an event listener when the event the listener is bound to is emitted', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
         });
      });

      it('executes an event listener multiple times when the event the listener is bound to is emitted multiple times', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledThrice(listener);
         });
      });

      it('executes an event listener with the provided context', function() {
         var eventEmitter = new EventEmitter(),
             context = { testContext: true },
             listener = sinon.spy();

         eventEmitter.on('event1', listener, context);
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOn(listener, context);
         });
      });

      it('executes multiple event listeners when the event the listeners are bound to is emitted', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy(),
             listener3 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event1', listener2);
         eventEmitter.on('event1', listener3);

         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);
            sinon.assert.calledOnce(listener3);
         });
      });

      it('executes the listener, passing in the provided args', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy(),
             arg1 = 'test',
             arg2 = 42;

         eventEmitter.on('event1', listener);
         eventEmitter.emit('event1', arg1, arg2);

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
            sinon.assert.calledWithExactly(listener, arg1, arg2);
         });
      });

      it('does not execute a listener whose event has not been emitted', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event2', listener2);

         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.notCalled(listener2);
         });
      });

      it('executes event listeners for multiple events when the eventNames parameter is a space-delimited list of names', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy(),
             listener3 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event2', listener2);
         eventEmitter.on('event3', listener3);

         eventEmitter.emit('event1 event2 event3');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);
            sinon.assert.calledOnce(listener3);
         });
      });

      it('executes the same event listener multiple times when registered with different contexts', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy(),
             context1 = { testContext: 1 },
             context2 = { testContext: 2 },
             context3 = { testContext: 3 };

         eventEmitter.on('event1', listener, context1);
         eventEmitter.on('event1', listener, context2);
         eventEmitter.on('event1', listener, context3);

         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledThrice(listener);
            expect(getTimesFnCalledWithContext(listener, context1)).to.be(1);
            expect(getTimesFnCalledWithContext(listener, context2)).to.be(1);
            expect(getTimesFnCalledWithContext(listener, context3)).to.be(1);
         });
      });

      it('executes event listeners asynchronously', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);

         eventEmitter.emit('event1');

         sinon.assert.notCalled(listener);

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
         });
      });
   });

   describe('on', function() {
      it('is chainable', function() {
         var eventEmitter = new EventEmitter();

         expect(eventEmitter.on('event1', _.noop)).to.be(eventEmitter);
      });

      it('throws an error if the eventNames parameter is not a string', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*must be a string.*/;

         expect(eventEmitter.on.bind(eventEmitter)).to.throwError(errorRegex);
         expect(eventEmitter.on.bind(eventEmitter, null)).to.throwError(errorRegex);
         expect(eventEmitter.on.bind(eventEmitter, _.noop)).to.throwError(errorRegex);
      });

      it('throws an error if the listener parameter is not a function', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*must be a function.*/;

         expect(eventEmitter.on.bind(eventEmitter, 'event1', null)).to.throwError(errorRegex);
         expect(eventEmitter.on.bind(eventEmitter, 'event1', [])).to.throwError(errorRegex);
         expect(eventEmitter.on.bind(eventEmitter, 'event1', true)).to.throwError(errorRegex);
      });

      it('adds event listeners for multiple events when the eventNames parameter is a space-delimited list of names', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1 event2 event3', listener);

         function step1() {
            sinon.assert.calledOnce(listener);
            eventEmitter.emit('event2');
         }
         function step2() {
            sinon.assert.calledTwice(listener);
            eventEmitter.emit('event3');
         }
         function step3() {
            sinon.assert.calledThrice(listener);
         }

         eventEmitter.emit('event1');
         return nestFunctions([ step1, step2, step3 ]);
      });

      it('does not allow binding the same listener twice (function only)', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);
         eventEmitter.on('event1', listener);

         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
         });
      });

      it('does not allow binding the same listener twice (function and context)', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy(),
             context = {};

         eventEmitter.on('event1', listener, context);
         eventEmitter.on('event1', listener, context);

         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
         });
      });
   });

   describe('once', function() {
      it('is chainable', function() {
         var eventEmitter = new EventEmitter();

         expect(eventEmitter.once('event1', _.noop)).to.be(eventEmitter);
      });

      it('throws an error if the eventName parameter is not a string', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*must be a string.*/;

         expect(eventEmitter.once.bind(eventEmitter)).to.throwError(errorRegex);
         expect(eventEmitter.once.bind(eventEmitter, null)).to.throwError(errorRegex);
         expect(eventEmitter.once.bind(eventEmitter, _.noop)).to.throwError(errorRegex);
      });

      it('throws an error if the eventName parameter is a space-delimited list of event names', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*it should not contain a space.*/;
         expect(eventEmitter.once.bind(eventEmitter, 'event1 event2')).to.throwError(errorRegex);
      });

      it('throws an error if the listener parameter is not a function', function() {
         var eventEmitter = new EventEmitter(),
             errorRegex;

         errorRegex = /.*must be a function.*/;

         expect(eventEmitter.once.bind(eventEmitter, 'event1', null)).to.throwError(errorRegex);
         expect(eventEmitter.once.bind(eventEmitter, 'event1', [])).to.throwError(errorRegex);
         expect(eventEmitter.once.bind(eventEmitter, 'event1', true)).to.throwError(errorRegex);
      });

      it('binds a listener that is only ever called once when events are emitted', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.once('event1', listener);

         eventEmitter.emit('event1').emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
         });
      });

      it('binds a listener that is called once, with the correct context', function() {
         var eventEmitter = new EventEmitter(),
             context = { testContext: true },
             listener = sinon.spy();

         eventEmitter.once('event1', listener, context);
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledOnce(listener);
            sinon.assert.calledOn(listener, context);
         });
      });
   });

   describe('off', function() {
      it('is chainable', function() {
         var eventEmitter = new EventEmitter();

         expect(eventEmitter.off('event1')).to.be(eventEmitter);
      });

      it('removes all event listeners when no event name is provided', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy(),
             listener3 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event2', listener2);
         eventEmitter.on('event3', listener3);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1 event2 event3');
         function step1() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);
            sinon.assert.calledOnce(listener3);

            listener1.reset();
            listener2.reset();
            listener3.reset();

            // Test #off
            eventEmitter.off();
            eventEmitter.emit('event1 event2 event3');
         }

         function step2() {
            sinon.assert.notCalled(listener1);
            sinon.assert.notCalled(listener2);
            sinon.assert.notCalled(listener3);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('removes all event listeners bound to an event name when only an event name is provided', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event1', listener2);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1');
         function step1() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);

            listener1.reset();
            listener2.reset();

            // Test #off
            eventEmitter.off('event1');
            eventEmitter.emit('event1');
         }

         function step2() {
            sinon.assert.notCalled(listener1);
            sinon.assert.notCalled(listener2);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('removes all event listeners for an event name, function, and any context when given only an event name and function', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy(),
             context1 = {},
             context2 = {};

         eventEmitter.on('event1', listener);
         eventEmitter.on('event1', listener, context1);
         eventEmitter.on('event1', listener, context2);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1');
         function step1() {
            sinon.assert.calledThrice(listener);

            listener.reset();

            // Test #off
            eventEmitter.off('event1', listener);
            eventEmitter.emit('event1');
         }

         function step2() {
            sinon.assert.notCalled(listener);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('removes only the matching event listener bound to an event name when the name, function, and context is provided', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy(),
             context1 = { testContext: 1 },
             context2 = { testContext: 2 };

         eventEmitter.on('event1', listener, context1);
         eventEmitter.on('event1', listener, context2);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1');
         function step1() {
            sinon.assert.calledTwice(listener);
            expect(getTimesFnCalledWithContext(listener, context1)).to.be(1);
            expect(getTimesFnCalledWithContext(listener, context2)).to.be(1);

            listener.reset();

            // Test #off
            eventEmitter.off('event1', listener, context1);
            eventEmitter.emit('event1');
         }

         function step2() {
            sinon.assert.calledOnce(listener);
            expect(getTimesFnCalledWithContext(listener, context1)).to.be(0);
            expect(getTimesFnCalledWithContext(listener, context2)).to.be(1);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('removes event listeners for multiple events when the eventNames parameter is a space-delimited list of names', function() {
         var eventEmitter = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy(),
             listener3 = sinon.spy();

         eventEmitter.on('event1', listener1);
         eventEmitter.on('event2', listener2);
         eventEmitter.on('event3', listener3);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1 event2 event3');
         function step1() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);
            sinon.assert.calledOnce(listener3);

            listener1.reset();
            listener2.reset();
            listener3.reset();

            // Test #off
            eventEmitter.off('event1 event2 event3');
            eventEmitter.emit('event1 event2 event3');
         }

         function step2() {
            sinon.assert.notCalled(listener1);
            sinon.assert.notCalled(listener2);
            sinon.assert.notCalled(listener3);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('removes event listeners that were bound without a context', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1');
         function step1() {
            sinon.assert.calledOnce(listener);
            listener.reset();

            // Test #off
            eventEmitter.off('event1', listener);
            eventEmitter.emit('event1');
         }

         function step2() {
            sinon.assert.notCalled(listener);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('does not remove event listeners bound to event names that were not passed into the eventNames parameter', function() {
         var eventEmitter = new EventEmitter(),
             readyListener = sinon.spy(),
             itemPlayingListener = sinon.spy();

         eventEmitter.on('event1', readyListener);
         eventEmitter.on('event2', itemPlayingListener);

         // Assert that we have a valid test by first ensuring event listeners were
         // registered and called correctly.
         eventEmitter.emit('event1');
         eventEmitter.emit('event2');
         function step1() {
            sinon.assert.calledOnce(readyListener);
            sinon.assert.calledOnce(itemPlayingListener);

            readyListener.reset();
            itemPlayingListener.reset();

            // Test #off
            eventEmitter.off('event1', readyListener);
            eventEmitter.emit('event1');
            eventEmitter.emit('event2');
         }

         function step2() {
            sinon.assert.notCalled(readyListener);
            sinon.assert.calledOnce(itemPlayingListener);
         }

         return nestFunctions([ step1, step2 ]);
      });
   });

   describe('integration tests', function() {
      // TODO add more integration tests that emulate real-world scenarios such as
      // the passage of time between events, multiple event emitters interacting, etc.
      it('does not share event listeners across objects that mix-in the EventEmitterMixin', function() {
         var eventEmitter1 = new EventEmitter(),
             eventEmitter2 = new EventEmitter(),
             listener1 = sinon.spy(),
             listener2 = sinon.spy();

         eventEmitter1.on('event1', listener1);
         eventEmitter2.on('event1', listener2);

         eventEmitter1.emit('event1');
         function step1() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.notCalled(listener2);

            eventEmitter2.emit('event1');
         }

         function step2() {
            sinon.assert.calledOnce(listener1);
            sinon.assert.calledOnce(listener2);
         }

         return nestFunctions([ step1, step2 ]);
      });

      it('#once does not overwrite listeners already bound with #on', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1', listener);
         eventEmitter.once('event1', listener);

         eventEmitter.emit('event1');
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledThrice(listener);
         });
      });

      it('#on overwrites listeners already bound with #once', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.once('event1', listener);
         eventEmitter.on('event1', listener);

         eventEmitter.emit('event1');
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');

         return Q.delay(0).then(function() {
            sinon.assert.calledThrice(listener);
         });
      });

      it('#on overwrites listeners already bound with #once, but not others when given a space-delimited list of events', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.once('event2', listener);
         eventEmitter.on('event1 event2 event3', listener);

         // Should only be invoked 3 times. callCount = 3
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');

         // Should be invoked 3 times. callCount = 6
         eventEmitter.emit('event2');
         eventEmitter.emit('event2');
         eventEmitter.emit('event2');

         // Should be invoked 3 times. callCount = 9
         eventEmitter.emit('event3');
         eventEmitter.emit('event3');
         eventEmitter.emit('event3');

         return Q.delay(0).then(function() {
            expect(listener.callCount).to.be(9);
         });
      });

      it('#once does not overwrite listeners already bound with #on that were bound with a space-delimited list of events', function() {
         var eventEmitter = new EventEmitter(),
             listener = sinon.spy();

         eventEmitter.on('event1 event2 event3', listener);
         eventEmitter.once('event2', listener);

         // Should only be invoked 3 times. callCount = 3
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');
         eventEmitter.emit('event1');

         // Should be invoked 3 times. callCount = 6
         eventEmitter.emit('event2');
         eventEmitter.emit('event2');
         eventEmitter.emit('event2');

         // Should be invoked 3 times. callCount = 9
         eventEmitter.emit('event3');
         eventEmitter.emit('event3');
         eventEmitter.emit('event3');

         return Q.delay(0).then(function() {
            expect(listener.callCount).to.be(9);
         });
      });
   });
});
