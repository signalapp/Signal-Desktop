// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { throttle } from 'lodash';

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

export class ActiveWindowService {
  // This starting value might be wrong but we should get an update from the main process
  //  soon. We'd rather report that the window is inactive so we can show notifications.
  private isInitialized = false;

  private isFocused = false;

  private activeCallbacks: Array<() => void> = [];

  private changeCallbacks: Array<(isActive: boolean) => void> = [];

  private lastActiveEventAt = -Infinity;

  private callActiveCallbacks: () => void;

  constructor() {
    this.callActiveCallbacks = throttle(() => {
      this.activeCallbacks.forEach(callback => callback());
    }, LISTENER_THROTTLE_TIME);
  }

  // These types aren't perfectly accurate, but they make this class easier to test.
  initialize(document: EventTarget, ipc: NodeJS.EventEmitter): void {
    if (this.isInitialized) {
      throw new Error(
        'Active window service should not be initialized multiple times'
      );
    }
    this.isInitialized = true;

    this.lastActiveEventAt = Date.now();

    const onActiveEvent = this.onActiveEvent.bind(this);
    ACTIVE_EVENTS.forEach((eventName: string) => {
      document.addEventListener(eventName, onActiveEvent, true);
    });

    // We don't know for sure that we'll get the right data over IPC so we use `unknown`.
    ipc.on('set-window-focus', (_event: unknown, isFocused: unknown) => {
      this.setWindowFocus(Boolean(isFocused));
    });
  }

  isActive(): boolean {
    return (
      this.isFocused && Date.now() < this.lastActiveEventAt + ACTIVE_TIMEOUT
    );
  }

  registerForActive(callback: () => void): void {
    this.activeCallbacks.push(callback);
  }

  unregisterForActive(callback: () => void): void {
    this.activeCallbacks = this.activeCallbacks.filter(
      item => item !== callback
    );
  }

  registerForChange(callback: (isActive: boolean) => void): void {
    this.changeCallbacks.push(callback);
  }

  unregisterForChange(callback: (isActive: boolean) => void): void {
    this.changeCallbacks = this.changeCallbacks.filter(
      item => item !== callback
    );
  }

  private onActiveEvent(): void {
    this.updateState(() => {
      this.lastActiveEventAt = Date.now();
    });
  }

  private setWindowFocus(isFocused: boolean): void {
    this.updateState(() => {
      this.isFocused = isFocused;
    });
  }

  private updateState(fn: () => void): void {
    const wasActiveBefore = this.isActive();
    fn();
    const isActiveNow = this.isActive();

    if (!wasActiveBefore && isActiveNow) {
      this.callActiveCallbacks();
    }

    if (wasActiveBefore !== isActiveNow) {
      for (const callback of this.changeCallbacks) {
        callback(isActiveNow);
      }
    }
  }
}
