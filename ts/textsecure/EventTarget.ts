// tslint:disable no-default-export

/*
 * Implements EventTarget
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */

export default class EventTarget {
  listeners?: { [type: string]: Array<Function> };

  dispatchEvent(ev: Event) {
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

  addEventListener(eventName: string, callback: Function) {
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

  removeEventListener(eventName: string, callback: Function) {
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

  extend(source: any) {
    const target = this as any;

    // tslint:disable-next-line forin no-for-in no-default-export
    for (const prop in source) {
      target[prop] = source[prop];
    }
    return target;
  }
}
