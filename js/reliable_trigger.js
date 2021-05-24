/* eslint-disable */

// This file was taken from Backbone and then modified. It does not conform to this
//   project's standards.

(function() {
  'use strict';

  // Note: this is all the code required to customize Backbone's trigger() method to make
  //   it resilient to exceptions thrown by event handlers. Indentation and code styles
  //   were kept inline with the Backbone implementation for easier diffs.

  // The changes are:
  //   1. added 'name' parameter to triggerEvents to give it access to the
  //      current event name
  //   2. added try/catch handlers to triggerEvents with error logging inside
  //      every while loop

  // And of course, we update the protoypes of Backbone.Model/Backbone.View as well as
  //   Backbone.Events itself

  const arr = [];

  const slice = arr.slice;

  // Regular expression used to split event strings.
  const eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  const eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (const key in name) {
        obj[action](...[key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      const names = name.split(eventSplitter);
      for (let i = 0, l = names.length; i < l; i++) {
        obj[action](...[names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  const triggerEvents = function(events, name, args) {
    let ev,
      i = -1,
      l = events.length,
      a1 = args[0],
      a2 = args[1],
      a3 = args[2];
    const logError = function(error) {
      window.log.error(
        'Model caught error triggering',
        name,
        'event:',
        error && error.stack ? error.stack : error
      );
    };
    switch (args.length) {
      case 0:
        while (++i < l) {
          try {
            (ev = events[i]).callback.call(ev.ctx);
          } catch (error) {
            logError(error);
          }
        }
        return;
      case 1:
        while (++i < l) {
          try {
            (ev = events[i]).callback.call(ev.ctx, a1);
          } catch (error) {
            logError(error);
          }
        }
        return;
      case 2:
        while (++i < l) {
          try {
            (ev = events[i]).callback.call(ev.ctx, a1, a2);
          } catch (error) {
            logError(error);
          }
        }
        return;
      case 3:
        while (++i < l) {
          try {
            (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
          } catch (error) {
            logError(error);
          }
        }
        return;
      default:
        while (++i < l) {
          try {
            (ev = events[i]).callback.apply(ev.ctx, args);
          } catch (error) {
            logError(error);
          }
        }
    }
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  function trigger(name) {
    if (!this._events) return this;
    const args = slice.call(arguments, 1);
    if (!eventsApi(this, 'trigger', name, args)) return this;
    const events = this._events[name];
    const allEvents = this._events.all;
    if (events) triggerEvents(events, name, args);
    if (allEvents) triggerEvents(allEvents, name, arguments);
    return this;
  }

  Backbone.Model.prototype.trigger = Backbone.View.prototype.trigger = Backbone.Collection.prototype.trigger = Backbone.Events.trigger = trigger;
})();
