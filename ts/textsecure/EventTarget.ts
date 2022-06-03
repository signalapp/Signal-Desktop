// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

/*
 * Implements EventTarget
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */

export type EventHandler = (event: any) => unknown;

export default class EventTarget {
  listeners?: { [type: string]: Array<EventHandler> };

  dispatchEvent(ev: Event): Array<unknown> {
    if (!(ev instanceof Event)) {
      throw new Error('Expects an event');
    }
    if (this.listeners === null || typeof this.listeners !== 'object') {
      this.listeners = {};
    }
    const listeners = this.listeners[ev.type];
    const results = [];
    if (typeof listeners === 'object') {
      const max = listeners.length;
      for (let i = 0; i < max; i += 1) {
        const listener = listeners[i];
        if (typeof listener === 'function') {
          results.push(listener.call(null, ev));
        }
      }
    }
    return results;
  }

  addEventListener(eventName: string, callback: EventHandler): void {
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
  }

  removeEventListener(eventName: string, callback: EventHandler): void {
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
  }

  extend(source: any): any {
    const target = this as any;

    for (const prop in source) {
      target[prop] = source[prop];
    }
    return target;
  }
}
