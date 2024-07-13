// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { EventEmitter, once } from 'events';
import { Readable } from 'stream';
import { createServer } from 'http';
import type {
  IncomingMessage,
  ServerResponse,
  Server,
  OutgoingHttpHeaders,
} from 'http';
import { strictAssert } from '../../../util/assert';

export type NextResponse = Readonly<{
  status: number;
  headers: OutgoingHttpHeaders;
}>;

export type LastRequestData = Readonly<{
  method?: string;
  url?: string;
  headers: OutgoingHttpHeaders;
  body: Buffer;
}>;

export class TestServer extends EventEmitter {
  #server: Server;
  #nextResponse: NextResponse = { status: 200, headers: {} };
  #lastRequest: { request: IncomingMessage; body: Buffer } | null = null;

  constructor() {
    super();
    this.#server = createServer(this.#onRequest);
  }

  async listen(): Promise<void> {
    await new Promise<void>(resolve => {
      this.#server.listen(0, resolve);
    });
  }

  closeLastRequest(): void {
    this.#lastRequest?.request.destroy();
  }

  async closeServer(): Promise<void> {
    if (!this.#server.listening) {
      return;
    }
    this.#server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      this.#server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  get endpoint(): string {
    const address = this.#server.address();
    strictAssert(
      typeof address === 'object' && address != null,
      'address must be an object'
    );
    return `http://localhost:${address.port}/`;
  }

  respondWith(status: number, headers: OutgoingHttpHeaders = {}): void {
    this.#nextResponse = { status, headers };
  }

  lastRequest(): LastRequestData | null {
    const request = this.#lastRequest;
    if (request == null) {
      return null;
    }
    return {
      method: request.request.method,
      url: request.request.url,
      headers: request.request.headers,
      body: request.body,
    };
  }

  #onRequest = (request: IncomingMessage, response: ServerResponse) => {
    this.emit('request');
    const nextResponse = this.#nextResponse;
    const lastRequest = { request, body: Buffer.alloc(0) };
    this.#lastRequest = lastRequest;
    request.on('data', chunk => {
      lastRequest.body = Buffer.concat([lastRequest.body, chunk]);
      this.emit('data');
    });
    request.on('end', () => {
      response.writeHead(nextResponse.status, nextResponse.headers);
      this.#nextResponse = { status: 200, headers: {} };
      response.end();
    });
    request.on('error', error => {
      response.destroy(error);
    });
  };
}

export function body(
  server: TestServer,
  steps: () => AsyncIterator<Uint8Array, void, number>
): Readable {
  const iter = steps();
  let first = true;
  return new Readable({
    async read(size: number) {
      try {
        // To make tests more reliable, we want each `yield` in body() to be
        // processed before we yield the next chunk.
        if (first) {
          first = false;
        } else {
          await once(server, 'data');
        }
        const chunk = await iter.next(size);
        if (chunk.done) {
          this.push(null);
          return;
        }
        this.push(chunk.value);
      } catch (error) {
        this.destroy(error);
      }
    },
  });
}
