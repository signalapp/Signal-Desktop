// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BroadcastEventNameType } from './protocol.std.ts';
import { EventName } from './protocol.std.ts';

// Pending events in the renderer, keyed by the object they describe. A newer
// event for the same object replaces the older one, so a burst of updates
// to one message costs one event. An update to an object whose `added` is
// still queued stays `added`: the client has not heard of it yet.

export type QueuedEventType<T> = Readonly<{
  key: string;
  event: BroadcastEventNameType;
  data: T;
}>;

export class EventQueue<T> {
  readonly #maxSize: number;
  #pending = new Map<string, QueuedEventType<T>>();

  constructor(maxSize: number) {
    this.#maxSize = maxSize;
  }

  get size(): number {
    return this.#pending.size;
  }

  // Returns false if the queue is full; the caller must then clear it and
  // tell clients to resynchronize.
  push(key: string, event: BroadcastEventNameType, data: T): boolean {
    const existing = this.#pending.get(key);
    if (!existing && this.#pending.size >= this.#maxSize) {
      return false;
    }
    const keepAdded =
      existing?.event === EventName.MessageAdded &&
      event === EventName.MessageUpdated;
    // Delete first so the object moves to the end and order follows the
    // latest change.
    this.#pending.delete(key);
    this.#pending.set(key, {
      key,
      event: keepAdded ? EventName.MessageAdded : event,
      data,
    });
    return true;
  }

  // Removes and returns up to `max` events, oldest first.
  take(max: number): Array<QueuedEventType<T>> {
    const taken = new Array<QueuedEventType<T>>();
    for (const [key, value] of this.#pending) {
      if (taken.length >= max) {
        break;
      }
      taken.push(value);
      this.#pending.delete(key);
    }
    return taken;
  }

  clear(): void {
    this.#pending = new Map();
  }
}
