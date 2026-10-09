// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { connect } from 'node:net';
import type { Socket } from 'node:net';

import {
  clientTranscript,
  decodeBase64Url,
  encodeBase64Url,
} from '../externalClient/auth.node.ts';
import {
  FrameDecoder,
  FrameKind,
  encodeJsonFrame,
} from '../externalClient/framing.std.ts';
import { LIMITS, PROTOCOL_NAME } from '../externalClient/protocol.std.ts';

export type FakeResponseType = {
  id: string | null;
  result?: Record<string, unknown>;
  error?: { code: string; message: string; reason?: string };
};

export type FakeEventType = {
  event: string;
  seq: number;
  data: Record<string, unknown>;
};

export type FakeKeyType = Readonly<{
  privateKey: KeyObject;
  publicKey: string;
}>;

export function generateFakeClientKey(): FakeKeyType {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const { x } = publicKey.export({ format: 'jwk' });
  if (typeof x !== 'string') {
    throw new Error('generateFakeClientKey: no public key');
  }
  return { privateKey, publicKey: x };
}

// Minimal external client that drives the server the way a real one would.
export class FakeClient {
  readonly #decoder = new FrameDecoder({
    maxPayloadBytes: LIMITS.maxFrameBytes,
    allowedKinds: [FrameKind.Json],
  });
  readonly #messages = new Array<FakeResponseType>();
  readonly #events = new Array<FakeEventType>();
  readonly #waiters = new Array<() => void>();
  readonly socket: Socket;
  readonly clientNonce = encodeBase64Url(randomBytes(32));
  closed = false;
  #nextId = 0;

  constructor(socket: Socket) {
    this.socket = socket;
    socket.on('data', chunk => {
      for (const frame of this.#decoder.push(chunk)) {
        const message = JSON.parse(new TextDecoder().decode(frame.payload));
        if ('event' in message) {
          this.#events.push(message);
        } else {
          this.#messages.push(message);
        }
      }
      this.#wake();
    });
    socket.on('close', () => {
      this.closed = true;
      this.#wake();
    });
    socket.on('error', () => null);
  }

  static async connect(path: string): Promise<FakeClient> {
    const socket = connect(path);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    return new FakeClient(socket);
  }

  send(value: unknown): void {
    this.socket.write(encodeJsonFrame(value));
  }

  async next(timeoutMs = 2000): Promise<FakeResponseType> {
    await this.#waitFor(() => this.#messages.length > 0, timeoutMs);
    const message = this.#messages.shift();
    if (!message) {
      throw new Error('FakeClient: no message');
    }
    return message;
  }

  async nextEvent(timeoutMs = 2000): Promise<FakeEventType> {
    await this.#waitFor(() => this.#events.length > 0, timeoutMs);
    const event = this.#events.shift();
    if (!event) {
      throw new Error('FakeClient: no event');
    }
    return event;
  }

  get pendingEvents(): number {
    return this.#events.length;
  }

  async request(method: string, params?: unknown): Promise<FakeResponseType> {
    const id = `r${this.#nextId}`;
    this.#nextId += 1;
    this.send(params === undefined ? { id, method } : { id, method, params });
    return this.next();
  }

  helloParams(): Record<string, unknown> {
    return {
      protocol: PROTOCOL_NAME,
      versions: [1],
      client: { name: 'fake-client', version: '0.0.1' },
      clientNonce: this.clientNonce,
    };
  }

  // Returns the hello result.
  async hello(): Promise<Record<string, unknown>> {
    const response = await this.request('session.hello', this.helloParams());
    if (!response.result) {
      throw new Error(`hello failed: ${JSON.stringify(response.error)}`);
    }
    return response.result;
  }

  static proof(
    key: FakeKeyType,
    hello: Record<string, unknown>,
    sessionId = String(hello.sessionId)
  ): string {
    return encodeBase64Url(
      sign(
        null,
        clientTranscript(sessionId, decodeBase64Url(String(hello.challenge))),
        key.privateKey
      )
    );
  }

  async authenticate(
    key: FakeKeyType,
    hello: Record<string, unknown>
  ): Promise<FakeResponseType> {
    return this.request('session.authenticate', {
      publicKey: key.publicKey,
      signature: FakeClient.proof(key, hello),
    });
  }

  async requestAuthorization(
    key: FakeKeyType,
    hello: Record<string, unknown>,
    capabilities: ReadonlyArray<string>,
    displayName = 'Fake Client'
  ): Promise<FakeResponseType> {
    return this.request('authorization.request', {
      publicKey: key.publicKey,
      signature: FakeClient.proof(key, hello),
      displayName,
      capabilities,
    });
  }

  async waitClosed(timeoutMs = 2000): Promise<void> {
    await this.#waitFor(() => this.closed, timeoutMs);
  }

  get pending(): number {
    return this.#messages.length;
  }

  close(): void {
    this.socket.destroy();
  }

  async #waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error('FakeClient: timed out');
      }
      // oxlint-disable-next-line no-await-in-loop
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, remaining);
        this.#waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  #wake(): void {
    for (const waiter of this.#waiters.splice(0)) {
      waiter();
    }
  }
}
