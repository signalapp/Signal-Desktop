// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'node:events';

import type { NativeServer } from './binding.js';
import { getBinding } from './binding.js';
import { LocalPipeSocket } from './socket.js';

export { LocalPipeSocket };

/**
 * Listens on a named pipe that only the current user can open and that
 * refuses remote (SMB) clients. Emits 'connection' with a LocalPipeSocket
 * and 'error' if the listener fails after it started.
 */
export class LocalPipeServer extends EventEmitter {
  #native: NativeServer | undefined;
  #closed: Promise<void> | undefined;
  #resolveClosed: (() => void) | undefined;

  listen(name: string): Promise<void> {
    if (this.#native) {
      throw new Error('Already listening');
    }
    return new Promise((resolve, reject) => {
      let started = false;
      this.#closed = new Promise((resolveClosed) => {
        this.#resolveClosed = resolveClosed;
      });
      this.#native = new (getBinding().PipeServer)(name, (type, payload) => {
        switch (type) {
          case 'listening':
            started = true;
            resolve();
            return;
          case 'connection':
            this.emit(
              'connection',
              new LocalPipeSocket(payload.pipe, payload.clientProcessId),
            );
            return;
          case 'error':
            if (started) {
              this.emit('error', payload);
            } else {
              reject(payload);
            }
            return;
          case 'closed':
            this.#native = undefined;
            this.#resolveClosed?.();
            return;
          default:
            return;
        }
      });
    });
  }

  close(): Promise<void> {
    const closed = this.#closed ?? Promise.resolve();
    this.#native?.close();
    return closed;
  }
}
