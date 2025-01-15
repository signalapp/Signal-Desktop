// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { throttle } from '../util/throttle';

// Idle timer - you're active for ACTIVE_TIMEOUT after one of these events
const ACTIVE_TIMEOUT = 15 * 1000;
const LISTENER_THROTTLE_TIME = 5 * 1000;
const ACTIVE_EVENTS = [
  'click',
  'keydown',
  'mousedown',
  'mousemove',
  // 'scroll', // this is triggered by Timeline re-renders, can't use
  'touchstart',
  'wheel',
];

class ActiveWindowService {
  // This starting value might be wrong but we should get an update from the main process
  //  soon. We'd rather report that the window is inactive so we can show notifications.
  #isInitialized = false;

  #isFocused = false;
  #activeCallbacks: Array<() => void> = [];
  #changeCallbacks: Array<(isActive: boolean) => void> = [];
  #lastActiveEventAt = -Infinity;
  #callActiveCallbacks: () => void;

  constructor() {
    this.#callActiveCallbacks = throttle(() => {
      this.#activeCallbacks.forEach(callback => callback());
    }, LISTENER_THROTTLE_TIME);
  }

  // These types aren't perfectly accurate, but they make this class easier to test.
  initialize(document: EventTarget, ipc: NodeJS.EventEmitter): void {
    if (this.#isInitialized) {
      throw new Error(
        'Active window service should not be initialized multiple times'
      );
    }
    this.#isInitialized = true;

    this.#lastActiveEventAt = Date.now();

    const onActiveEvent = this.#onActiveEvent.bind(this);
    ACTIVE_EVENTS.forEach((eventName: string) => {
      document.addEventListener(eventName, onActiveEvent, true);
    });

    // We don't know for sure that we'll get the right data over IPC so we use `unknown`.
    ipc.on('set-window-focus', (_event: unknown, isFocused: unknown) => {
      this.#setWindowFocus(Boolean(isFocused));
    });
  }

  isActive(): boolean {
    return (
      this.#isFocused && Date.now() < this.#lastActiveEventAt + ACTIVE_TIMEOUT
    );
  }

  registerForActive(callback: () => void): void {
    this.#activeCallbacks.push(callback);
  }

  unregisterForActive(callback: () => void): void {
    this.#activeCallbacks = this.#activeCallbacks.filter(
      item => item !== callback
    );
  }

  registerForChange(callback: (isActive: boolean) => void): void {
    this.#changeCallbacks.push(callback);
  }

  unregisterForChange(callback: (isActive: boolean) => void): void {
    this.#changeCallbacks = this.#changeCallbacks.filter(
      item => item !== callback
    );
  }

  #onActiveEvent(): void {
    this.#updateState(() => {
      this.#lastActiveEventAt = Date.now();
    });
  }

  #setWindowFocus(isFocused: boolean): void {
    this.#updateState(() => {
      this.#isFocused = isFocused;
    });
  }

  #updateState(fn: () => void): void {
    const wasActiveBefore = this.isActive();
    fn();
    const isActiveNow = this.isActive();

    if (!wasActiveBefore && isActiveNow) {
      this.#callActiveCallbacks();
    }

    if (wasActiveBefore !== isActiveNow) {
      for (const callback of this.#changeCallbacks) {
        callback(isActiveNow);
      }
    }
  }
}

export type ActiveWindowServiceType = {
  isActive(): boolean;
  registerForActive(callback: () => void): void;
  unregisterForActive(callback: () => void): void;
  registerForChange(callback: (isActive: boolean) => void): void;
  unregisterForChange(callback: (isActive: boolean) => void): void;
};

export function getActiveWindowService(
  document: EventTarget,
  ipc: NodeJS.EventEmitter
): ActiveWindowServiceType {
  const activeWindowService = new ActiveWindowService();
  activeWindowService.initialize(document, ipc);

  return {
    isActive(): boolean {
      return activeWindowService.isActive();
    },
    registerForActive(callback: () => void): void {
      return activeWindowService.registerForActive(callback);
    },
    unregisterForActive(callback: () => void): void {
      return activeWindowService.unregisterForActive(callback);
    },
    registerForChange(callback: (isActive: boolean) => void): void {
      return activeWindowService.registerForChange(callback);
    },
    unregisterForChange(callback: (isActive: boolean) => void): void {
      return activeWindowService.unregisterForChange(callback);
    },
  };
}
