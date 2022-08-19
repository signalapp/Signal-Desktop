// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { noop } from 'lodash';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import type { LoggerType } from '../../types/Logging';
import { strictAssert } from '../../util/assert';
import { dropNull } from '../../util/dropNull';
import { UUID_BYTE_SIZE } from '../../types/UUID';
import * as Bytes from '../../Bytes';
import { uuidToBytes, bytesToUuid } from '../../Crypto';
import { SignalService as Proto } from '../../protobuf';
import type {
  CDSRequestOptionsType,
  CDSResponseEntryType,
  CDSResponseType,
} from './Types.d';

export type CDSSocketBaseOptionsType = Readonly<{
  logger: LoggerType;
  socket: WebSocket;
}>;

export type CDSSocketResponseType = Readonly<{
  response: CDSResponseType;
  retryAfterSecs?: number;
}>;

export enum CDSSocketState {
  Open = 'Open',
  Handshake = 'Handshake',
  Established = 'Established',
  Closed = 'Closed',
}

const MAX_E164_COUNT = 5000;
const E164_BYTE_SIZE = 8;
const TRIPLE_BYTE_SIZE = UUID_BYTE_SIZE * 2 + E164_BYTE_SIZE;

export abstract class CDSSocketBase<
  Options extends CDSSocketBaseOptionsType = CDSSocketBaseOptionsType
> extends EventEmitter {
  protected state = CDSSocketState.Open;

  protected readonly socket: WebSocket;

  protected readonly logger: LoggerType;

  protected readonly socketIterator: AsyncIterator<Buffer>;

  constructor(protected readonly options: Options) {
    super();

    // For easier access
    this.logger = options.logger;
    this.socket = options.socket;

    this.socketIterator = this.iterateSocket();
  }

  public async close(code: number, reason: string): Promise<void> {
    return this.socket.close(code, reason);
  }

  public async request({
    e164s,
    acis,
    accessKeys,
    returnAcisWithoutUaks = false,
  }: CDSRequestOptionsType): Promise<CDSSocketResponseType> {
    const log = this.logger;

    strictAssert(
      e164s.length < MAX_E164_COUNT,
      'CDSSocket does not support paging. Use this for one-off requests'
    );

    strictAssert(
      this.state === CDSSocketState.Established,
      'CDS Connection not established'
    );

    const aciUakPairs = new Array<Uint8Array>();

    const version = 2;
    strictAssert(
      acis.length === accessKeys.length,
      `Number of ACIs ${acis.length} is different ` +
        `from number of access keys ${accessKeys.length}`
    );

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
      returnAcisWithoutUaks,
    }).finish();

    log.info(`CDSSocket.request(): sending version=${version} request`);
    await this.sendRequest(version, Buffer.from(request));

    const resultMap: Map<string, CDSResponseEntryType> = new Map();
    let retryAfterSecs: number | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value: ciphertext } = await this.socketIterator.next();
      if (done) {
        this.state = CDSSocketState.Closed;
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      const message = await this.decryptResponse(ciphertext);

      log.info('CDSSocket.request(): processing response message');

      const response = Proto.CDSClientResponse.decode(message);
      const newRetryAfterSecs = dropNull(response.retryAfterSecs);

      decodeSingleResponse(resultMap, response);

      if (newRetryAfterSecs) {
        retryAfterSecs = Math.max(newRetryAfterSecs, retryAfterSecs ?? 0);
      }
    }

    log.info('CDSSocket.request(): done');

    return {
      response: resultMap,
      retryAfterSecs,
    };
  }

  // Abstract methods

  public abstract handshake(): Promise<void>;

  protected abstract sendRequest(version: number, data: Buffer): Promise<void>;

  protected abstract decryptResponse(ciphertext: Buffer): Promise<Buffer>;

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

  //
  // Private
  //

  private iterateSocket(): AsyncIterator<Buffer> {
    const stream = new Readable({ read: noop, objectMode: true });

    this.socket.on('message', ({ type, binaryData }) => {
      strictAssert(type === 'binary', 'Invalid CDS socket packet');
      strictAssert(binaryData, 'Invalid CDS socket packet');

      stream.push(binaryData);
    });

    this.socket.on('close', (code, reason) => {
      if (code === 1000) {
        stream.push(null);
      } else {
        stream.destroy(
          new Error(`Socket closed with code ${code} and reason ${reason}`)
        );
      }
    });
    this.socket.on('error', (error: Error) => stream.destroy(error));

    return stream[Symbol.asyncIterator]();
  }
}

function decodeSingleResponse(
  resultMap: Map<string, CDSResponseEntryType>,
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
