// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import ProxyAgent from 'proxy-agent';
import { HsmEnclaveClient, PublicKey } from '@signalapp/signal-client';
import type { connection as WebSocket } from 'websocket';

import * as Bytes from '../Bytes';
import { prefixPublicKey } from '../Curve';
import type { AbortableProcess } from '../util/AbortableProcess';
import * as durations from '../util/durations';
import { sleep } from '../util/sleep';
import * as log from '../logging/log';
import { CDSSocket } from './CDSSocket';
import type {
  CDSRequestOptionsType,
  CDSSocketDictionaryType,
} from './CDSSocket';
import { connect as connectWebSocket } from './WebSocket';

export type CDSSocketManagerOptionsType = Readonly<{
  url: string;
  publicKey: string;
  codeHash: string;
  certificateAuthority: string;
  proxyUrl?: string;
  version: string;
}>;

export type CDSResponseType = CDSSocketDictionaryType;

export class CDSSocketManager {
  private readonly publicKey: PublicKey;

  private readonly codeHash: Buffer;

  private readonly proxyAgent?: ReturnType<typeof ProxyAgent>;

  private retryAfter?: number;

  constructor(private readonly options: CDSSocketManagerOptionsType) {
    this.publicKey = PublicKey.deserialize(
      Buffer.from(prefixPublicKey(Bytes.fromHex(options.publicKey)))
    );
    this.codeHash = Buffer.from(Bytes.fromHex(options.codeHash));
    if (options.proxyUrl) {
      this.proxyAgent = new ProxyAgent(options.proxyUrl);
    }
  }

  public async request(
    options: CDSRequestOptionsType
  ): Promise<CDSResponseType> {
    if (this.retryAfter !== undefined) {
      const delay = Math.max(0, this.retryAfter - Date.now());

      log.info(`CDSSocketManager: waiting ${delay}ms before retrying`);
      await sleep(delay);
    }

    log.info('CDSSocketManager: connecting socket');
    const socket = await this.connect().getResult();
    log.info('CDSSocketManager: connected socket');

    try {
      const { dictionary, retryAfterSecs = 0 } = await socket.request(options);

      if (retryAfterSecs > 0) {
        this.retryAfter = Math.max(
          this.retryAfter ?? Date.now(),
          Date.now() + retryAfterSecs * durations.SECOND
        );
      }

      return dictionary;
    } finally {
      log.info('CDSSocketManager: closing socket');
      socket.close(3000, 'Normal');
    }
  }

  private connect(): AbortableProcess<CDSSocket> {
    const enclaveClient = HsmEnclaveClient.new(this.publicKey, [this.codeHash]);

    const {
      publicKey: publicKeyHex,
      codeHash: codeHashHex,
      version,
    } = this.options;

    const url = `${this.options.url}/discovery/${publicKeyHex}/${codeHashHex}`;

    return connectWebSocket<CDSSocket>({
      name: 'CDSSocket',
      url,
      version,
      proxyAgent: this.proxyAgent,
      certificateAuthority: this.options.certificateAuthority,

      createResource: (socket: WebSocket): CDSSocket => {
        return new CDSSocket(socket, enclaveClient);
      },
    });
  }
}
