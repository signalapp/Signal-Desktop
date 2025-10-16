// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import lodash from 'lodash';
import type { connection as WebSocket } from 'websocket';
import Long from 'long';

import type { LoggerType } from '../../types/Logging.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { isUntaggedPniString, toTaggedPni } from '../../types/ServiceId.std.js';
import { isAciString } from '../../util/isAciString.std.js';
import * as Bytes from '../../Bytes.std.js';
import { UUID_BYTE_SIZE } from '../../types/Crypto.std.js';
import { uuidToBytes, bytesToUuid } from '../../util/uuidToBytes.std.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import type {
  CDSRequestOptionsType,
  CDSResponseEntryType,
  CDSResponseType,
} from './Types.d.ts';
import { RateLimitedError } from './RateLimitedError.std.js';

const { noop } = lodash;

export type CDSSocketBaseOptionsType = Readonly<{
  logger: LoggerType;
  socket: WebSocket;
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
  Options extends CDSSocketBaseOptionsType = CDSSocketBaseOptionsType,
> extends EventEmitter {
  protected state = CDSSocketState.Open;

  protected readonly socket: WebSocket;

  protected readonly logger: LoggerType;

  protected readonly socketIterator: AsyncIterator<Uint8Array>;

  constructor(protected readonly options: Options) {
    super();

    // For easier access
    this.logger = options.logger;
    this.socket = options.socket;

    this.socketIterator = this.#iterateSocket();
  }

  public async close(code: number, reason: string): Promise<void> {
    return this.socket.close(code, reason);
  }

  public async request({
    e164s,
    acisAndAccessKeys,
    returnAcisWithoutUaks = false,
  }: CDSRequestOptionsType): Promise<CDSResponseType> {
    const log = this.logger;

    strictAssert(
      e164s.length < MAX_E164_COUNT,
      'CDSSocket does not support paging. Use this for one-off requests'
    );

    strictAssert(
      this.state === CDSSocketState.Established,
      'CDS Connection not established'
    );

    const version = 2;

    const aciUakPairs = acisAndAccessKeys.map(({ aci, accessKey }) =>
      Bytes.concatenate([uuidToBytes(aci), Bytes.fromBase64(accessKey)])
    );

    const request = Proto.CDSClientRequest.encode({
      newE164s: Bytes.concatenate(
        e164s.map(e164 => {
          // Long.fromString handles numbers with or without a leading '+'
          return new Uint8Array(Long.fromString(e164).toBytesBE());
        })
      ),
      aciUakPairs: Bytes.concatenate(aciUakPairs),
      returnAcisWithoutUaks,
    }).finish();

    log.info(`CDSSocket.request(): sending version=${version} request`);
    await this.sendRequest(version, request);

    const resultMap: Map<string, CDSResponseEntryType> = new Map();

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

      decodeSingleResponse(resultMap, response);
    }

    log.info('CDSSocket.request(): done');
    return { debugPermitsUsed: 0, entries: resultMap };
  }

  // Abstract methods

  public abstract handshake(): Promise<void>;

  protected abstract sendRequest(
    version: number,
    data: Uint8Array
  ): Promise<void>;

  protected abstract decryptResponse(
    ciphertext: Uint8Array
  ): Promise<Uint8Array>;

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

  #iterateSocket(): AsyncIterator<Uint8Array> {
    const stream = new Readable({ read: noop, objectMode: true });

    this.socket.on('message', ({ type, binaryData }) => {
      strictAssert(type === 'binary', 'Invalid CDS socket packet');
      strictAssert(binaryData, 'Invalid CDS socket packet');

      stream.push(binaryData);
    });

    this.socket.on('close', (code, reason) => {
      if (code === 1000) {
        stream.push(null);
      } else if (code === 4008) {
        try {
          const payload = JSON.parse(reason);

          stream.destroy(new RateLimitedError(payload));
        } catch (error) {
          stream.destroy(
            new Error(
              `Socket closed with code ${code} and reason ${reason}, ` +
                'but rate limiting response cannot be parsed'
            )
          );
        }
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
  if (!response.e164PniAciTriples) {
    return;
  }
  for (
    let i = 0;
    i < response.e164PniAciTriples.length;
    i += TRIPLE_BYTE_SIZE
  ) {
    const tripleBytes = response.e164PniAciTriples.subarray(
      i,
      i + TRIPLE_BYTE_SIZE
    );
    strictAssert(
      tripleBytes.length === TRIPLE_BYTE_SIZE,
      'Invalid size of CDS response triple'
    );

    let offset = 0;
    const e164Bytes = tripleBytes.subarray(offset, offset + E164_BYTE_SIZE);
    offset += E164_BYTE_SIZE;

    const pniBytes = tripleBytes.subarray(offset, offset + UUID_BYTE_SIZE);
    offset += UUID_BYTE_SIZE;

    const aciBytes = tripleBytes.subarray(offset, offset + UUID_BYTE_SIZE);
    offset += UUID_BYTE_SIZE;

    const e164Long = Long.fromBytesBE(Array.from(e164Bytes));
    if (e164Long.isZero()) {
      continue;
    }

    const e164 = `+${e164Long.toString()}`;
    const pni = bytesToUuid(pniBytes);
    const aci = bytesToUuid(aciBytes);
    strictAssert(
      aci === undefined || isAciString(aci),
      'CDSI response has invalid ACI'
    );
    strictAssert(
      pni === undefined || isUntaggedPniString(pni),
      'CDSI response has invalid PNI'
    );

    resultMap.set(e164, {
      pni: pni === undefined ? undefined : toTaggedPni(pni),
      aci,
    });
  }
}
