// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'events';
import { noop } from 'lodash';
import { Readable } from 'stream';
import type { HsmEnclaveClient } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import { explodePromise } from '../util/explodePromise';
import * as durations from '../util/durations';
import * as log from '../logging/log';
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

export type CDSRequestOptionsType = Readonly<
  {
    auth: CDSAuthType;
    e164s: ReadonlyArray<string>;
    timeout?: number;
  } & (
    | {
        version: 1;
        acis?: undefined;
        accessKeys?: undefined;
      }
    | {
        version: 2;
        acis: ReadonlyArray<UUIDStringType>;
        accessKeys: ReadonlyArray<string>;
      }
  )
>;

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

const MAX_E164_COUNT = 5000;
const HANDSHAKE_TIMEOUT = 10 * durations.SECOND;
const REQUEST_TIMEOUT = 10 * durations.SECOND;
const E164_BYTE_SIZE = 8;
const TRIPLE_BYTE_SIZE = UUID_BYTE_SIZE * 2 + E164_BYTE_SIZE;

export class CDSSocket extends EventEmitter {
  private state = State.Handshake;

  private readonly finishedHandshake: Promise<void>;

  private readonly responseStream = new Readable({
    read: noop,

    // Don't coalesce separate websocket messages
    objectMode: true,
  });

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

      try {
        this.responseStream.push(
          this.enclaveClient.establishedRecv(binaryData)
        );
      } catch (error) {
        this.responseStream.destroy(error);
      }
    });
    socket.on('close', (code, reason) => {
      if (this.state === State.Established) {
        if (code === 1000) {
          this.responseStream.push(null);
        } else {
          this.responseStream.destroy(
            new Error(`Socket closed with code ${code} and reason ${reason}`)
          );
        }
      }

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
    version,
    timeout = REQUEST_TIMEOUT,
    e164s,
    acis = [],
    accessKeys = [],
  }: CDSRequestOptionsType): Promise<CDSSocketResponseType> {
    strictAssert(
      e164s.length < MAX_E164_COUNT,
      'CDSSocket does not support paging. Use this for one-off requests'
    );

    log.info('CDSSocket.request(): awaiting handshake');
    await this.finishedHandshake;
    strictAssert(
      this.state === State.Established,
      'Connection not established'
    );

    strictAssert(
      acis.length === accessKeys.length,
      `Number of ACIs ${acis.length} is different ` +
        `from number of access keys ${accessKeys.length}`
    );
    const aciUakPairs = new Array<Uint8Array>();
    for (let i = 0; i < acis.length; i += 1) {
      aciUakPairs.push(
        Bytes.concatenate([
          uuidToBytes(acis[i]),
          Bytes.fromBase64(accessKeys[i]),
        ])
      );
    }

    const request = Proto.CDSClientRequest.encode({
      newE164s: Buffer.concat(
        e164s.map(e164 => {
          // Long.fromString handles numbers with or without a leading '+'
          return new Uint8Array(Long.fromString(e164).toBytesBE());
        })
      ),
      aciUakPairs: Buffer.concat(aciUakPairs),
    }).finish();

    const timer = Timers.setTimeout(() => {
      this.responseStream.destroy(new Error('CDS request timed out'));
    }, timeout);

    log.info(`CDSSocket.request(): sending version=${version} request`);
    this.socket.sendBytes(
      this.enclaveClient.establishedSend(
        Buffer.concat([Buffer.from([version]), request])
      )
    );

    const resultMap: Map<string, CDSSocketDictionaryEntryType> = new Map();
    let retryAfterSecs: number | undefined;

    for await (const message of this.responseStream) {
      log.info('CDSSocket.request(): processing response message');

      const response = Proto.CDSClientResponse.decode(message);
      const newRetryAfterSecs = dropNull(response.retryAfterSecs);

      decodeSingleResponse(resultMap, response);

      if (newRetryAfterSecs) {
        retryAfterSecs = Math.max(newRetryAfterSecs, retryAfterSecs ?? 0);
      }
    }

    const result: Record<string, CDSSocketDictionaryEntryType> =
      Object.create(null);

    for (const [key, value] of resultMap) {
      result[key] = value;
    }

    log.info('CDSSocket.request(): done');
    Timers.clearTimeout(timer);

    return {
      dictionary: result,
      retryAfterSecs,
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

function decodeSingleResponse(
  resultMap: Map<string, CDSSocketDictionaryEntryType>,
  response: Proto.CDSClientResponse
): void {
  for (
    let i = 0;
    i < response.e164PniAciTriples.length;
    i += TRIPLE_BYTE_SIZE
  ) {
    const tripleBytes = response.e164PniAciTriples.slice(
      i,
      i + TRIPLE_BYTE_SIZE
    );
    strictAssert(
      tripleBytes.length === TRIPLE_BYTE_SIZE,
      'Invalid size of CDS response triple'
    );

    let offset = 0;
    const e164Bytes = tripleBytes.slice(offset, offset + E164_BYTE_SIZE);
    offset += E164_BYTE_SIZE;

    const pniBytes = tripleBytes.slice(offset, offset + UUID_BYTE_SIZE);
    offset += UUID_BYTE_SIZE;

    const aciBytes = tripleBytes.slice(offset, offset + UUID_BYTE_SIZE);
    offset += UUID_BYTE_SIZE;

    const e164Long = Long.fromBytesBE(Array.from(e164Bytes));
    if (e164Long.isZero()) {
      continue;
    }

    const e164 = `+${e164Long.toString()}`;
    const pni = bytesToUuid(pniBytes);
    const aci = bytesToUuid(aciBytes);

    resultMap.set(e164, { pni, aci });
  }
}
