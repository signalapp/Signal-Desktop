// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'events';
import type { HsmEnclaveClient } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import { strictAssert } from '../util/assert';
import { explodePromise } from '../util/explodePromise';
import * as durations from '../util/durations';
import type { UUIDStringType } from '../types/UUID';
import * as Bytes from '../Bytes';
import * as Timers from '../Timers';
import { splitUuids } from '../Crypto';

enum State {
  Handshake,
  Established,
  Closed,
}

export type CDSRequestOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  auth: CDSAuthType;
  timeout?: number;
}>;

export type CDSAuthType = Readonly<{
  username: string;
  password: string;
}>;

const HANDSHAKE_TIMEOUT = 10 * durations.SECOND;
const REQUEST_TIMEOUT = 10 * durations.SECOND;
const VERSION = new Uint8Array([0x01]);
const USERNAME_LENGTH = 32;
const PASSWORD_LENGTH = 31;

export class CDSSocket extends EventEmitter {
  private state = State.Handshake;

  private readonly finishedHandshake: Promise<void>;

  private readonly requestQueue = new Array<(buffer: Buffer) => void>();

  constructor(
    private readonly socket: WebSocket,
    private readonly enclaveClient: HsmEnclaveClient
  ) {
    super();

    const {
      promise: finishedHandshake,
      resolve,
      reject,
    } = explodePromise<void>();
    this.finishedHandshake = finishedHandshake;

    const timer = Timers.setTimeout(() => {
      reject(new Error('CDS handshake timed out'));
    }, HANDSHAKE_TIMEOUT);

    socket.on('message', ({ type, binaryData }) => {
      strictAssert(type === 'binary', 'Invalid CDS socket packet');
      strictAssert(binaryData, 'Invalid CDS socket packet');

      if (this.state === State.Handshake) {
        this.enclaveClient.completeHandshake(binaryData);
        this.state = State.Established;
        Timers.clearTimeout(timer);
        resolve();
        return;
      }

      const requestHandler = this.requestQueue.shift();
      strictAssert(
        requestHandler !== undefined,
        'No handler for incoming CDS data'
      );

      requestHandler(this.enclaveClient.establishedRecv(binaryData));
    });
    socket.on('close', (code, reason) => {
      this.state = State.Closed;
      this.emit('close', code, reason);
    });
    socket.on('error', (error: Error) => this.emit('error', error));

    socket.sendBytes(this.enclaveClient.initialRequest());
  }

  public close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  public async request({
    e164s,
    auth,
    timeout = REQUEST_TIMEOUT,
  }: CDSRequestOptionsType): Promise<ReadonlyArray<UUIDStringType | null>> {
    await this.finishedHandshake;
    strictAssert(
      this.state === State.Established,
      'Connection not established'
    );

    const username = Bytes.fromString(auth.username);
    const password = Bytes.fromString(auth.password);
    strictAssert(
      username.length === USERNAME_LENGTH,
      'Invalid username length'
    );
    strictAssert(
      password.length === PASSWORD_LENGTH,
      'Invalid password length'
    );

    const request = Bytes.concatenate([
      VERSION,
      username,
      password,
      ...e164s.map(e164 => {
        // Long.fromString handles numbers with or without a leading '+'
        return new Uint8Array(Long.fromString(e164).toBytesBE());
      }),
    ]);

    const { promise, resolve, reject } = explodePromise<Buffer>();

    const timer = Timers.setTimeout(() => {
      reject(new Error('CDS request timed out'));
    }, timeout);

    this.socket.sendBytes(
      this.enclaveClient.establishedSend(Buffer.from(request))
    );

    this.requestQueue.push(resolve);
    strictAssert(
      this.requestQueue.length === 1,
      'Concurrent use of CDS shold not happen'
    );
    const uuids = await promise;

    Timers.clearTimeout(timer);

    return splitUuids(uuids);
  }

  // EventEmitter types

  public on(
    type: 'close',
    callback: (code: number, reason?: string) => void
  ): this;
  public on(type: 'error', callback: (error: Error) => void): this;

  public on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public emit(type: 'close', code: number, reason?: string): boolean;
  public emit(type: 'error', error: Error): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
