// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'events';
import type { HsmEnclaveClient } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import { explodePromise } from '../util/explodePromise';
import * as durations from '../util/durations';
import type { UUIDStringType } from '../types/UUID';
import { UUID_BYTE_SIZE } from '../types/UUID';
import * as Bytes from '../Bytes';
import * as Timers from '../Timers';
import { uuidToBytes, bytesToUuid } from '../Crypto';
import { SignalService as Proto } from '../protobuf';

enum State {
  Handshake,
  Established,
  Closed,
}

export type CDSRequestOptionsType = Readonly<{
  e164s: ReadonlyArray<string>;
  acis: ReadonlyArray<UUIDStringType>;
  accessKeys: ReadonlyArray<string>;
  auth: CDSAuthType;
  timeout?: number;
}>;

export type CDSAuthType = Readonly<{
  username: string;
  password: string;
}>;

export type CDSSocketDictionaryEntryType = Readonly<{
  aci: UUIDStringType | undefined;
  pni: UUIDStringType | undefined;
}>;

export type CDSSocketDictionaryType = Readonly<
  Record<string, CDSSocketDictionaryEntryType>
>;

export type CDSSocketResponseType = Readonly<{
  dictionary: CDSSocketDictionaryType;
  retryAfterSecs?: number;
}>;

const HANDSHAKE_TIMEOUT = 10 * durations.SECOND;
const REQUEST_TIMEOUT = 10 * durations.SECOND;
const VERSION = new Uint8Array([0x02]);
const USERNAME_LENGTH = 32;
const PASSWORD_LENGTH = 31;
const E164_BYTE_SIZE = 8;

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
    acis,
    accessKeys,
    auth,
    timeout = REQUEST_TIMEOUT,
  }: CDSRequestOptionsType): Promise<CDSSocketResponseType> {
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

    strictAssert(
      acis.length === accessKeys.length,
      `Number of ACIs ${acis.length} is different ` +
        `from number of access keys ${accessKeys.length}`
    );
    const aciUakPair = new Array<Uint8Array>();
    for (let i = 0; i < acis.length; i += 1) {
      aciUakPair.push(
        Bytes.concatenate([
          uuidToBytes(acis[i]),
          Bytes.fromBase64(accessKeys[i]),
        ])
      );
    }

    const request = Proto.CDSClientRequest.encode({
      username,
      password,
      e164: e164s.map(e164 => {
        // Long.fromString handles numbers with or without a leading '+'
        return new Uint8Array(Long.fromString(e164).toBytesBE());
      }),
      aciUakPair,
    }).finish();

    const { promise, resolve, reject } = explodePromise<Buffer>();

    const timer = Timers.setTimeout(() => {
      reject(new Error('CDS request timed out'));
    }, timeout);

    this.socket.sendBytes(
      this.enclaveClient.establishedSend(Buffer.concat([VERSION, request]))
    );

    this.requestQueue.push(resolve);
    strictAssert(
      this.requestQueue.length === 1,
      'Concurrent use of CDS shold not happen'
    );
    const responseBytes = await promise;
    Timers.clearTimeout(timer);

    const response = Proto.CDSClientResponse.decode(responseBytes);

    const dictionary: Record<string, CDSSocketDictionaryEntryType> =
      Object.create(null);

    for (const tripleBytes of response.e164PniAciTriple ?? []) {
      strictAssert(
        tripleBytes.length === UUID_BYTE_SIZE * 2 + E164_BYTE_SIZE,
        'Invalid size of CDS response triple'
      );

      let offset = 0;
      const e164Bytes = tripleBytes.slice(offset, offset + E164_BYTE_SIZE);
      offset += E164_BYTE_SIZE;

      const pniBytes = tripleBytes.slice(offset, offset + UUID_BYTE_SIZE);
      offset += UUID_BYTE_SIZE;

      const aciBytes = tripleBytes.slice(offset, offset + UUID_BYTE_SIZE);
      offset += UUID_BYTE_SIZE;

      const e164 = `+${Long.fromBytesBE(Array.from(e164Bytes)).toString()}`;
      const pni = bytesToUuid(pniBytes);
      const aci = bytesToUuid(aciBytes);

      dictionary[e164] = { pni, aci };
    }

    return {
      dictionary,
      retryAfterSecs: dropNull(response.retryAfterSecs),
    };
  }

  // EventEmitter types

  public override on(
    type: 'close',
    callback: (code: number, reason?: string) => void
  ): this;
  public override on(type: 'error', callback: (error: Error) => void): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(type: 'close', code: number, reason?: string): boolean;
  public override emit(type: 'error', error: Error): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
