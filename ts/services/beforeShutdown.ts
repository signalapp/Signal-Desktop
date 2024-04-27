// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IpcMainEvent } from 'electron';

type Listener = (event: IpcMainEvent, ...args: Array<unknown>) => void;

const listeners: Array<Listener> = [];

/**
 * Add a listener that will be called right before the app shuts down.
 *
 * This is useful for doing any necessary cleanup, such as closing connections
 * or saving data.
 *
 * @param listener The listener to add.
 */
export function addBeforeShutdownListener(listener: Listener): void {
  listeners.push(listener);
}

/**
 * Remove a previously added listener.
 *
 * @param listener The listener to remove.
 */
export function removeBeforeShutdownListener(listener: Listener): void {
  const index = listeners.indexOf(listener);
  if (index > -1) {
    listeners.splice(index, 1);
  }
}

/**
 * Call all of the registered listeners.
 *
 * This should be called right before the app shuts down.
 *
 * @param event The event that triggered the shutdown.
 * @param args Any additional arguments to pass to the listeners.
 */
export function callBeforeShutdownListeners(
  event: IpcMainEvent,
  ...args: Array<unknown>
): void {
  for (const listener of listeners) {
    listener(event, ...args);
  }
}
