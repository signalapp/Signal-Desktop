// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The last payload sent for each recently changed object, so an update that
// changes nothing a client can see (a delivery receipt, say, while the DTO
// has no receipt status) is not sent at all. Bounded; an evicted object just
// gets its next update sent.
export class SentPayloadCache {
  readonly #maxSize: number;
  #sent = new Map<string, string>();

  constructor(maxSize: number) {
    this.#maxSize = maxSize;
  }

  // Records the payload and returns whether it differs from the last one.
  record(key: string, serialized: string): boolean {
    const changed = this.#sent.get(key) !== serialized;
    this.#sent.delete(key);
    this.#sent.set(key, serialized);
    if (this.#sent.size > this.#maxSize) {
      const oldest = this.#sent.keys().next();
      if (!oldest.done) {
        this.#sent.delete(oldest.value);
      }
    }
    return changed;
  }

  has(key: string): boolean {
    return this.#sent.has(key);
  }

  forget(key: string): void {
    this.#sent.delete(key);
  }

  clear(): void {
    this.#sent = new Map();
  }
}
