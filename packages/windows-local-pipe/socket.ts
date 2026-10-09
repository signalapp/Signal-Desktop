// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Duplex } from 'node:stream';

import type { NativeConnection, NativeEvent, PendingPipe } from './binding.js';
import { getBinding } from './binding.js';

/**
 * One accepted connection, as a Duplex stream of raw bytes.
 */
export class LocalPipeSocket extends Duplex {
  readonly clientProcessId: number;
  readonly #native: NativeConnection;
  readonly #writeCallbacks = new Map<number, (error?: Error | null) => void>();
  #nextWriteId = 0;
  readonly #onClosed: Array<() => void> = [];
  #nativeClosed = false;

  /** @internal */
  constructor(pipe: PendingPipe, clientProcessId: number) {
    super({ allowHalfOpen: false });
    this.clientProcessId = clientProcessId;
    this.#native = new (getBinding().PipeConnection)(pipe, (...event) =>
      this.#onEvent(event),
    );
  }

  #onEvent([type, payload]: NativeEvent): void {
    switch (type) {
      case 'data':
        if (!this.push(payload)) {
          this.#native.setReading(false);
        }
        return;
      case 'end':
        this.push(null);
        return;
      case 'writeDone': {
        const callback = this.#writeCallbacks.get(payload.id);
        this.#writeCallbacks.delete(payload.id);
        callback?.(
          payload.code === 0
            ? null
            : new Error(`Pipe write failed with Windows error ${payload.code}`),
        );
        return;
      }
      case 'error':
        this.destroy(payload);
        return;
      case 'closed':
        this.#nativeClosed = true;
        this.push(null);
        for (const resolve of this.#onClosed.splice(0)) {
          resolve();
        }
        return;
      default:
        return;
    }
  }

  #closeNative(): Promise<void> {
    if (this.#nativeClosed) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.#onClosed.push(resolve);
      this.#native.close();
    });
  }

  override _read(): void {
    this.#native.setReading(true);
  }

  override _write(
    // oxlint-disable-next-line typescript/no-unnecessary-type-arguments
    chunk: Buffer<ArrayBufferLike>,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const id = this.#nextWriteId;
    this.#nextWriteId = (this.#nextWriteId + 1) % 0x100000000;
    this.#writeCallbacks.set(id, callback);
    try {
      this.#native.write(chunk, id);
    } catch (error) {
      this.#writeCallbacks.delete(id);
      callback(error as Error);
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    // Every write has completed by now; close our end. The client can
    // still read anything left in the pipe buffer.
    void this.#closeAndCall(callback, null);
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    void this.#closeAndCall(callback, error);
  }

  async #closeAndCall(
    callback: (error?: Error | null) => void,
    error: Error | null,
  ): Promise<void> {
    await this.#closeNative();
    callback(error);
  }
}
