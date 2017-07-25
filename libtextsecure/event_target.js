/*
 * vim: ts=4:sw=4:expandtab
 *
 * Implements EventTarget
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 */

;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function EventTarget() {
    }

    EventTarget.prototype = {
        constructor: EventTarget,
        dispatchEvent: function(ev) {
            if (!(ev instanceof Event)) {
                throw new Error('Expects an event');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[ev.type];
            var results = [];
            if (typeof listeners === 'object') {
                for (var i = 0, max = listeners.length; i < max; i += 1) {
                    var listener = listeners[i];
                    if (typeof listener === 'function') {
                        results.push(listener.call(null, ev));
                    }
                }
            }
            return results;
        },
        addEventListener: function(eventName, callback) {
            if (typeof eventName !== 'string') {
                throw new Error('First argument expects a string');
            }
            if (typeof callback !== 'function') {
                throw new Error('Second argument expects a function');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[eventName];
            if (typeof listeners !== 'object') {
                listeners = [];
            }
            listeners.push(callback);
            this.listeners[eventName] = listeners;
        },
        removeEventListener: function(eventName, callback) {
            if (typeof eventName !== 'string') {
                throw new Error('First argument expects a string');
            }
            if (typeof callback !== 'function') {
                throw new Error('Second argument expects a function');
            }
            if (this.listeners === null || typeof this.listeners !== 'object') {
                this.listeners = {};
            }
            var listeners = this.listeners[eventName];
            if (typeof listeners === 'object') {
                for (var i=0; i < listeners.length; ++ i) {
                    if (listeners[i] === callback) {
                        listeners.splice(i, 1);
                        return;
                    }
                }
            }
            this.listeners[eventName] = listeners;
        },
        extend: function(obj) {
          for (var prop in obj) {
            this[prop] = obj[prop];
          }
          return this;
        }
    };

    textsecure.EventTarget = EventTarget;
}());
