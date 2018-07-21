/* global window, Event, textsecure */

/*
 * Implements EventTarget
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  function EventTarget() {}

  EventTarget.prototype = {
    constructor: EventTarget,
    dispatchEvent(ev) {
      if (!(ev instanceof Event)) {
        throw new Error('Expects an event');
      }
      if (this.listeners === null || typeof this.listeners !== 'object') {
        this.listeners = {};
      }
      const listeners = this.listeners[ev.type];
      const results = [];
      if (typeof listeners === 'object') {
        for (let i = 0, max = listeners.length; i < max; i += 1) {
          const listener = listeners[i];
          if (typeof listener === 'function') {
            results.push(listener.call(null, ev));
          }
        }
      }
      return results;
    },
    addEventListener(eventName, callback) {
      if (typeof eventName !== 'string') {
        throw new Error('First argument expects a string');
      }
      if (typeof callback !== 'function') {
        throw new Error('Second argument expects a function');
      }
      if (this.listeners === null || typeof this.listeners !== 'object') {
        this.listeners = {};
      }
      let listeners = this.listeners[eventName];
      if (typeof listeners !== 'object') {
        listeners = [];
      }
      listeners.push(callback);
      this.listeners[eventName] = listeners;
    },
    removeEventListener(eventName, callback) {
      if (typeof eventName !== 'string') {
        throw new Error('First argument expects a string');
      }
      if (typeof callback !== 'function') {
        throw new Error('Second argument expects a function');
      }
      if (this.listeners === null || typeof this.listeners !== 'object') {
        this.listeners = {};
      }
      const listeners = this.listeners[eventName];
      if (typeof listeners === 'object') {
        for (let i = 0; i < listeners.length; i += 1) {
          if (listeners[i] === callback) {
            listeners.splice(i, 1);
            return;
          }
        }
      }
      this.listeners[eventName] = listeners;
    },
    extend(obj) {
      // eslint-disable-next-line no-restricted-syntax, guard-for-in
      for (const prop in obj) {
        this[prop] = obj[prop];
      }
      return this;
    },
  };

  textsecure.EventTarget = EventTarget;
})();
